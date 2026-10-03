import { IModels } from '~/connectionResolvers';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { MAIL_HEALTH_STATUSES } from '@/integrations/mail/constants';
import { buildMailAddress } from '@/integrations/mail/utils/allocate';
import { ensureMailIndexes } from '@/integrations/mail/utils/indexes';
import {
  normalizeForwardFrom,
  normalizeSenderName,
} from '@/integrations/mail/utils/settings';
import { assertSendableIntegration } from '@/integrations/mail/utils/transports/readiness';
import { assertImapReachable } from '@/integrations/mail/utils/external/imap';
import {
  IExternalServerInput,
  MAIL_PROVIDERS,
  isExternalIntegration,
  normalizeExternalSettings,
  readExternalAddress,
} from '@/integrations/mail/utils/external/settings';
import {
  scheduleImapSync,
  unscheduleImapSync,
} from '@/integrations/mail/utils/external/worker';

export interface IPipelineMailSettings {
  senderName?: string;
  forwardFrom?: string;
  statusId?: string;
  // 'imap' reads and sends through the pipeline's own mailbox instead of a
  // Cloudflare-routed address.
  provider?: string;
  address?: string;
  imap?: IExternalServerInput;
  smtp?: IExternalServerInput;
}

export interface IPipelineMailConnectInput extends IPipelineMailSettings {
  models: IModels;
  subdomain: string;
  pipelineId: string;
}

/**
 * A disconnected address keeps its row so the address, and the thread scope
 * keyed on that row's id, survive a reconnect. Every reader wants the connected
 * one; `disabledAt: null` also matches rows written before the field existed.
 */
export const findPipelineIntegration = async (
  models: IModels,
  pipelineId?: string,
) =>
  pipelineId
    ? models.MailIntegrations.findOne({ pipelineId, disabledAt: null })
    : null;

const findDisconnectedPipelineMail = (models: IModels, pipelineId: string) =>
  models.MailIntegrations.findOne({
    pipelineId,
    disabledAt: { $ne: null },
  });

const getPipeline = async (models: IModels, pipelineId: string) => {
  const pipeline = await models.Pipeline.findOne({ _id: pipelineId }).lean();

  if (!pipeline) {
    throw new Error('Ticket pipeline not found');
  }

  return pipeline;
};

const normalizePipelineStatusId = async (
  models: IModels,
  pipelineId: string,
  value: unknown,
) => {
  const statusId = typeof value === 'string' ? value.trim() : '';

  if (!statusId) {
    return '';
  }

  const status = await models.Status.findOne({
    _id: statusId,
    pipelineId,
  }).lean();

  if (!status) {
    throw new Error(
      'New mail tickets can only open in a status of this pipeline',
    );
  }

  return statusId;
};

const wantsExternal = (provider?: string) => provider === MAIL_PROVIDERS.IMAP;

// The external-server fields for a pipeline mailbox, validated and with
// passwords encrypted; signs in once so a typo fails here, not in the worker.
const externalFields = async (
  subdomain: string,
  settings: IPipelineMailSettings,
  previous?: IMailIntegrationDocument | null,
) => {
  const address = readExternalAddress(settings.address ?? previous?.address);
  const { imap, smtp } = normalizeExternalSettings(
    subdomain,
    settings,
    previous,
  );

  await assertImapReachable(subdomain, imap);

  return { provider: MAIL_PROVIDERS.IMAP, address, imap, smtp };
};

const assertAddressFree = async (
  models: IModels,
  address: string,
  ownId?: string,
) => {
  const holder = await models.MailIntegrations.findOne({
    address,
    ...(ownId ? { _id: { $ne: ownId } } : {}),
  });

  if (holder && !holder.disabledAt) {
    throw new Error(`${address} is already connected elsewhere in erxes`);
  }

  if (holder) {
    await models.MailIntegrations.deleteOne({ _id: holder._id });
  }
};

const releaseAddress = async (models: IModels, address: string) => {
  const holder = await models.MailIntegrations.findOne({ address });

  if (!holder) {
    return;
  }

  if (!holder.pipelineId) {
    throw new Error(
      `${address} already belongs to a channel inbox — rename this pipeline to take a different address`,
    );
  }

  const pipeline = await models.Pipeline.findOne({
    _id: holder.pipelineId,
  }).lean();

  if (pipeline) {
    throw new Error(
      `${address} already belongs to the ${pipeline.name} pipeline — rename this pipeline to take a different address`,
    );
  }

  await models.MailIntegrations.deleteOne({ _id: holder._id });
};

const forwardSetupFields = (forwardFrom: string) =>
  forwardFrom
    ? { forwardFrom, forwardPendingAt: new Date(), forwardVerification: null }
    : { forwardFrom: '', forwardPendingAt: null, forwardVerification: null };

export const connectPipelineMail = async ({
  models,
  subdomain,
  pipelineId,
  ...settings
}: IPipelineMailConnectInput): Promise<IMailIntegrationDocument> => {
  const { senderName, forwardFrom, statusId } = settings;
  const pipeline = await getPipeline(models, pipelineId);

  const openingStatusId = await normalizePipelineStatusId(
    models,
    pipelineId,
    statusId,
  );

  await ensureMailIndexes(models, subdomain);

  const connected = await findPipelineIntegration(models, pipelineId);

  if (connected) {
    throw new Error(
      `This pipeline already writes mail from ${connected.address}`,
    );
  }

  const disconnected = await findDisconnectedPipelineMail(models, pipelineId);

  if (wantsExternal(settings.provider)) {
    const external = await externalFields(
      subdomain,
      settings,
      disconnected && isExternalIntegration(disconnected) ? disconnected : null,
    );

    await assertAddressFree(models, external.address, disconnected?._id);

    const doc = {
      pipelineId,
      name: pipeline.name,
      ...external,
      senderName: normalizeSenderName(senderName),
      statusId: openingStatusId,
      healthStatus: MAIL_HEALTH_STATUSES.HEALTHY,
      error: '',
      disabledAt: null,
      forwardFrom: '',
      forwardPendingAt: null,
      forwardVerification: null,
    };

    // Reusing the disconnected row keeps the thread scope (its _id), so
    // replies to tickets created before the switch still find their ticket.
    const saved = disconnected
      ? ((await models.MailIntegrations.findOneAndUpdate(
          { _id: disconnected._id },
          { $set: doc },
          { new: true },
        )) as IMailIntegrationDocument)
      : await models.MailIntegrations.create(doc);

    await scheduleImapSync({ subdomain, integrationId: saved._id });

    return saved;
  }

  await assertSendableIntegration(subdomain);

  if (disconnected) {
    return models.MailIntegrations.findOneAndUpdate(
      { _id: disconnected._id },
      {
        $set: {
          name: pipeline.name,
          senderName: normalizeSenderName(senderName),
          statusId: openingStatusId,
          healthStatus: MAIL_HEALTH_STATUSES.HEALTHY,
          error: '',
          disabledAt: null,
          provider: MAIL_PROVIDERS.CLOUDFLARE,
          ...forwardSetupFields(
            normalizeForwardFrom(forwardFrom, disconnected.address),
          ),
        },
      },
      { new: true },
    ) as Promise<IMailIntegrationDocument>;
  }

  const address = await buildMailAddress(subdomain, pipeline.name);

  await releaseAddress(models, address);

  return models.MailIntegrations.create({
    pipelineId,
    name: pipeline.name,
    address,
    senderName: normalizeSenderName(senderName),
    statusId: openingStatusId,
    healthStatus: MAIL_HEALTH_STATUSES.HEALTHY,
    error: '',
    ...forwardSetupFields(normalizeForwardFrom(forwardFrom, address)),
  });
};

export const updatePipelineMail = async (
  models: IModels,
  subdomain: string,
  pipelineId: string,
  settings: IPipelineMailSettings,
): Promise<IMailIntegrationDocument> => {
  const { senderName, forwardFrom, statusId } = settings;
  const integration = await findPipelineIntegration(models, pipelineId);

  if (!integration) {
    throw new Error('This pipeline has no mail address');
  }

  const update: Record<string, unknown> = {
    healthStatus: MAIL_HEALTH_STATUSES.HEALTHY,
    error: '',
  };

  if (senderName !== undefined) {
    update.senderName = normalizeSenderName(senderName);
  }

  if (statusId !== undefined) {
    update.statusId = await normalizePipelineStatusId(
      models,
      pipelineId,
      statusId,
    );
  }

  const external = isExternalIntegration(integration);

  if (external && (settings.imap || settings.smtp || settings.address)) {
    const fields = await externalFields(subdomain, settings, integration);

    await assertAddressFree(models, fields.address, integration._id);

    Object.assign(update, fields);
  }

  if (!external && forwardFrom !== undefined) {
    const wanted = normalizeForwardFrom(forwardFrom, integration.address);

    if (wanted !== (integration.forwardFrom ?? '')) {
      Object.assign(update, forwardSetupFields(wanted));
    }
  }

  const saved = (await models.MailIntegrations.findOneAndUpdate(
    { _id: integration._id },
    { $set: update },
    { new: true },
  )) as IMailIntegrationDocument;

  if (external) {
    await scheduleImapSync({ subdomain, integrationId: saved._id });
  }

  return saved;
};

export const markPipelineForwardVerified = async (
  models: IModels,
  pipelineId: string,
): Promise<IMailIntegrationDocument> => {
  const integration = await findPipelineIntegration(models, pipelineId);

  if (!integration) {
    throw new Error('This pipeline has no mail address');
  }

  return models.MailIntegrations.findOneAndUpdate(
    { _id: integration._id },
    { $unset: { forwardPendingAt: '', forwardVerification: '' } },
    { new: true },
  ) as Promise<IMailIntegrationDocument>;
};

export const disconnectPipelineMail = async (
  models: IModels,
  subdomain: string,
  pipelineId: string,
) => {
  const integration = await findPipelineIntegration(models, pipelineId);

  if (!integration) {
    throw new Error('This pipeline has no mail address');
  }

  await models.MailIntegrations.updateOne(
    { _id: integration._id },
    { $set: { disabledAt: new Date() } },
  );

  if (isExternalIntegration(integration)) {
    await unscheduleImapSync({ subdomain, integrationId: integration._id });
  }

  return true;
};
