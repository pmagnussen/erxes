import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { getEnv, getSubdomain, sendTRPCMessage } from 'erxes-api-shared/utils';
import { generateModels, IModels } from '~/connectionResolvers';
import { ChannelScopes } from '@/channel/@types/channel';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { describeError } from '@/integrations/mail/utils/errors';
import {
  mailCreateIntegration,
  mailUpdateIntegration,
} from '@/integrations/mail/messageBroker';
import {
  MAIL_PROVIDERS,
  readExternalAddress,
} from '@/integrations/mail/utils/external/settings';
import {
  connectPipelineMail,
  disconnectPipelineMail,
  findPipelineIntegration,
  updatePipelineMail,
} from '@/integrations/mail/utils/pipeline';
import { sendRemoveIntegration } from '@/inbox/graphql/resolvers/mutations/integrations';

/**
 * Machine API for an outside control panel (e.g. vera.fo Tenant.Backend) to
 * set up mail channels without anyone opening the erxes UI.
 * Auth: `Authorization: Bearer <MAIL_PROVISION_TOKEN>`; unset token = API off.
 */
export const requireProvisionToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const expected = String(getEnv({ name: 'MAIL_PROVISION_TOKEN' }) || '');
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';

  const ok =
    expected.length >= 32 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));

  if (!ok) {
    res.status(401).json({ error: 'Invalid provisioning token' });
    return;
  }

  next();
};

export const ownerId = async (subdomain: string) => {
  const owner = await sendTRPCMessage({
    subdomain,
    pluginName: 'core',
    method: 'query',
    module: 'users',
    action: 'findOne',
    input: { query: { isOwner: true } },
    defaultValue: null,
  });

  if (!owner?._id) {
    throw new Error('This erxes workspace has no owner user yet');
  }

  return String(owner._id);
};

const serverView = (
  server?: IMailIntegrationDocument['smtp'] &
    Partial<NonNullable<IMailIntegrationDocument['imap']>>,
) =>
  server?.host
    ? {
        host: server.host,
        port: server.port,
        secure: server.secure,
        user: server.user,
        hasPassword: Boolean(server.password),
        ...(server.mailbox !== undefined
          ? {
              mailbox: server.mailbox,
              sentMailbox: server.sentMailbox,
              lastSyncedAt: server.lastSyncedAt ?? null,
            }
          : {}),
      }
    : null;

const mailView = (mail: IMailIntegrationDocument) => ({
  provider: mail.provider || MAIL_PROVIDERS.CLOUDFLARE,
  address: mail.address,
  senderName: mail.senderName ?? '',
  healthStatus: mail.healthStatus,
  error: mail.error ?? '',
  disabled: Boolean(mail.disabledAt),
  imap: serverView(mail.imap),
  smtp: serverView(mail.smtp),
});

const inboxView = async (models: IModels, mail: IMailIntegrationDocument) => {
  const inbox = await models.Integrations.findOne({ _id: mail.inboxId }).lean();
  const channel = inbox?.channelId
    ? await models.Channels.findOne({ _id: inbox.channelId }).lean()
    : null;

  return {
    integrationId: mail.inboxId,
    name: inbox?.name ?? '',
    channel: channel ? { _id: channel._id, name: channel.name } : null,
    ...mailView(mail),
  };
};

const pipelineView = async (
  models: IModels,
  mail: IMailIntegrationDocument,
) => {
  const pipeline = await models.Pipeline.findOne({
    _id: mail.pipelineId,
  }).lean();

  return {
    pipelineId: mail.pipelineId,
    pipelineName: pipeline?.name ?? '',
    statusId: mail.statusId ?? '',
    ...mailView(mail),
  };
};

// Finds or creates the team channel named by the caller; the owner is admin.
export const ensureChannel = async (
  models: IModels,
  userId: string,
  body: { channelId?: string; channelName?: string },
) => {
  if (body.channelId) {
    const channel = await models.Channels.findOne({ _id: body.channelId });

    if (!channel) {
      throw new Error(`Channel ${body.channelId} not found`);
    }

    return channel;
  }

  const name = String(body.channelName || '').trim();

  if (!name) {
    throw new Error('channelId or channelName is required');
  }

  return (
    (await models.Channels.findOne({ name, scope: ChannelScopes.TEAM })) ??
    (await models.Channels.createChannel({
      channelDoc: { name, scope: ChannelScopes.TEAM },
      memberIds: [],
      adminId: userId,
    }))
  );
};

const assertBrokerOk = (result: unknown) => {
  const r = result as { status?: string; errorMessage?: string } | undefined;

  if (r?.status === 'error') {
    throw new Error(r.errorMessage || 'Mail setup failed');
  }
};

const handle =
  (
    work: (
      req: Request,
      models: IModels,
      subdomain: string,
    ) => Promise<unknown>,
  ) =>
  async (req: Request, res: Response) => {
    try {
      const subdomain = getSubdomain(req);
      const models = await generateModels(subdomain);

      res.json(await work(req, models, subdomain));
    } catch (e) {
      res.status(400).json({ error: describeError(e) });
    }
  };

export interface IInboxBody {
  brandId?: string;
  channelId?: string;
  channelName?: string;
  name?: string;
  address?: string;
  senderName?: string;
  imap?: Record<string, unknown>;
  smtp?: Record<string, unknown>;
}

export const snapshotMail = async (models: IModels) => {
  const all = await models.MailIntegrations.find({}).lean();

  return {
    inboxes: await Promise.all(
      all.filter((m) => m.inboxId).map((m) => inboxView(models, m)),
    ),
    pipelines: await Promise.all(
      all.filter((m) => m.pipelineId).map((m) => pipelineView(models, m)),
    ),
  };
};

/** GET /mail/provision — every mail inbox and pipeline mailbox, no secrets. */
export const listProvisioned = handle(async (_req, models) =>
  snapshotMail(models),
);

/** GET /mail/provision/inboxes/:address */
export const getInbox = handle(async (req, models) => {
  const address = readExternalAddress(req.params.address);
  const mail = await models.MailIntegrations.findOne({
    address,
    inboxId: { $exists: true, $nin: [null, ''] },
  }).lean();

  if (!mail) {
    throw new Error(`No inbox for ${address}`);
  }

  return inboxView(models, mail);
});

/**
 * PUT /mail/provision/inboxes — idempotent on `address`: creates the channel
 * (if named), the inbox and its IMAP/SMTP settings, or updates them. Empty
 * passwords keep the stored ones.
 */
export const upsertInbox = handle(async (req, models, subdomain) =>
  upsertMailInbox(models, subdomain, (req.body ?? {}) as IInboxBody),
);

export const upsertMailInbox = async (
  models: IModels,
  subdomain: string,
  body: IInboxBody,
) => {
  const address = readExternalAddress(body.address);
  const userId = await ownerId(subdomain);
  const channel = await ensureChannel(models, userId, body);
  const name = String(body.name || '').trim() || address;

  const existing = await models.MailIntegrations.findOne({ address });

  if (existing?.pipelineId) {
    throw new Error(`${address} is used by a ticket pipeline`);
  }

  const data = JSON.stringify({
    provider: MAIL_PROVIDERS.IMAP,
    address,
    senderName: body.senderName,
    imap: body.imap,
    smtp: body.smtp,
  });

  if (existing?.inboxId) {
    assertBrokerOk(
      await mailUpdateIntegration({
        subdomain,
        data: { integrationId: existing.inboxId, doc: { data } },
      }),
    );

    await models.Integrations.updateOne(
      { _id: existing.inboxId },
      { $set: { name, channelId: channel._id } },
    );
  } else {
    const inbox = await models.Integrations.createIntegration(
      { kind: 'mail', name, channelId: channel._id },
      userId,
    );

    try {
      assertBrokerOk(
        await mailCreateIntegration({
          subdomain,
          data: { integrationId: inbox._id, data },
        }),
      );
    } catch (e) {
      await models.Integrations.removeIntegration(inbox._id);
      throw e;
    }
  }

  if (body.brandId) {
    const saved = await models.MailIntegrations.findOne({ address }).lean();

    await models.Integrations.updateOne(
      { _id: saved?.inboxId },
      { $set: { brandId: body.brandId } },
    );
  }

  const saved = await models.MailIntegrations.findOne({ address }).lean();

  return inboxView(models, saved as IMailIntegrationDocument);
};

/** DELETE /mail/provision/inboxes/:address — removes inbox and its mail. */
export const removeInbox = handle(async (req, models, subdomain) => {
  const address = readExternalAddress(req.params.address);
  const mail = await models.MailIntegrations.findOne({ address });

  if (!mail?.inboxId) {
    throw new Error(`No inbox for ${address}`);
  }

  await sendRemoveIntegration(subdomain, 'mail', {
    integrationId: mail.inboxId,
  });
  await models.Integrations.removeIntegration(mail.inboxId);

  return { removed: address };
});

/** GET /mail/provision/pipelines/:pipelineId */
export const getPipelineMail = handle(async (req, models) => {
  const mail = await findPipelineIntegration(models, req.params.pipelineId);

  if (!mail) {
    throw new Error('This pipeline has no mail address');
  }

  return pipelineView(models, mail);
});

/** PUT /mail/provision/pipelines/:pipelineId — connect or update. */
export const upsertPipelineMail = handle(async (req, models, subdomain) =>
  upsertPipelineMailbox(
    models,
    subdomain,
    req.params.pipelineId,
    (req.body ?? {}) as IInboxBody & { statusId?: string },
  ),
);

export const upsertPipelineMailbox = async (
  models: IModels,
  subdomain: string,
  pipelineId: string,
  body: IInboxBody & { statusId?: string },
) => {
  const settings = {
    provider: MAIL_PROVIDERS.IMAP,
    address: body.address,
    senderName: body.senderName,
    statusId: body.statusId,
    imap: body.imap,
    smtp: body.smtp,
  };

  const current = await findPipelineIntegration(models, pipelineId);

  const saved =
    current && current.provider === MAIL_PROVIDERS.IMAP
      ? await updatePipelineMail(models, subdomain, pipelineId, settings)
      : await (async () => {
          if (current) {
            await disconnectPipelineMail(models, subdomain, pipelineId);
          }

          return connectPipelineMail({
            models,
            subdomain,
            pipelineId,
            ...settings,
          });
        })();

  return pipelineView(models, saved);
};

/** DELETE /mail/provision/pipelines/:pipelineId — disconnect. */
export const removePipelineMail = handle(async (req, models, subdomain) => {
  await disconnectPipelineMail(models, subdomain, req.params.pipelineId);

  return { disconnected: req.params.pipelineId };
});
