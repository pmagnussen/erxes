import { Request, Response } from 'express';
import { getEnv, getSubdomain, sendTRPCMessage } from 'erxes-api-shared/utils';
import { initSchema, TInitInput } from '@/provision/schema';

interface IStep {
  step: string;
  status: 'ok' | 'pending' | 'error';
  detail?: unknown;
  error?: string;
}

const call = async (
  subdomain: string,
  pluginName: string,
  method: 'query' | 'mutation',
  module: string,
  action: string,
  input: unknown = {},
) =>
  sendTRPCMessage({
    subdomain,
    pluginName,
    method,
    module,
    action,
    input,
    throwOnError: true,
  });

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const ensureBrand = async (subdomain: string, input: TInitInput) => {
  const existing = await call(subdomain, 'core', 'query', 'brands', 'findOne', {
    query: { name: input.company.name },
  });

  if (existing?._id) {
    return existing;
  }

  return call(subdomain, 'core', 'mutation', 'brands', 'create', {
    data: {
      name: input.company.name,
      description: input.company.description ?? '',
    },
  });
};

// The customer signs in to Facebook inside erxes; this is where to send them.
const facebookConnectUrl = (subdomain: string, channelId: string) => {
  const domain = String(getEnv({ name: 'DOMAIN', subdomain }) || '').replace(
    /\/$/,
    '',
  );

  return `${domain}/settings/frontline/channels/details/${channelId}/facebook-messenger`;
};

const run = async (
  steps: IStep[],
  step: string,
  work: () => Promise<unknown>,
) => {
  try {
    const detail = await work();
    steps.push({ step, status: 'ok', detail });
    return detail;
  } catch (e) {
    steps.push({ step, status: 'error', error: errorText(e) });
    return undefined;
  }
};

/**
 * POST /provision/init — idempotent: brand, team channels, mail inbox
 * (external IMAP/SMTP), ticket pipeline (+ its own mailbox) and a Facebook
 * connect link. Each step is reported separately; a failed step does not
 * stop the rest, and re-running fixes it.
 */
export const initWorkspace = async (req: Request, res: Response) => {
  const parsed = initSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid body', issues: parsed.error.issues });
    return;
  }

  const input = parsed.data;
  const subdomain = getSubdomain(req);
  const steps: IStep[] = [];

  const brand = (await run(steps, 'brand', () =>
    ensureBrand(subdomain, input),
  )) as { _id?: string } | undefined;

  const channels: Record<string, string> = {};
  const wanted = new Set([
    ...input.channels,
    ...(input.mail ? [input.mail.channel] : []),
    ...(input.tickets ? [input.tickets.channel] : []),
    ...(input.facebook ? [input.facebook.channel] : []),
  ]);

  for (const name of wanted) {
    const channel = (await run(steps, `channel:${name}`, () =>
      call(
        subdomain,
        'frontline',
        'mutation',
        'mailProvision',
        'ensureChannel',
        {
          name,
        },
      ),
    )) as { _id?: string } | undefined;

    if (channel?._id) {
      channels[name] = channel._id;
    }
  }

  if (input.mail) {
    const { channel, inboxName, ...mailbox } = input.mail;
    const channelId = channels[channel];

    if (channelId) {
      await run(steps, 'mail-inbox', () =>
        call(
          subdomain,
          'frontline',
          'mutation',
          'mailProvision',
          'upsertInbox',
          {
            ...mailbox,
            channelId,
            name: inboxName,
            brandId: brand?._id,
          },
        ),
      );
    } else {
      steps.push({
        step: 'mail-inbox',
        status: 'error',
        error: `Channel ${channel} missing`,
      });
    }
  }

  if (input.tickets) {
    const channelId = channels[input.tickets.channel];
    const pipeline = channelId
      ? ((await run(steps, 'ticket-pipeline', () =>
          call(
            subdomain,
            'frontline',
            'mutation',
            'mailProvision',
            'ensurePipeline',
            {
              channelId,
              name: input.tickets?.pipelineName,
            },
          ),
        )) as { _id?: string } | undefined)
      : undefined;

    if (pipeline?._id && input.tickets.mail) {
      await run(steps, 'ticket-mail', () =>
        call(
          subdomain,
          'frontline',
          'mutation',
          'mailProvision',
          'upsertPipelineMail',
          { ...input.tickets?.mail, pipelineId: pipeline._id },
        ),
      );
    }
  }

  if (input.facebook) {
    const channelId = channels[input.facebook.channel];

    steps.push({
      step: 'facebook',
      status: channelId ? 'pending' : 'error',
      ...(channelId
        ? {
            detail: {
              action: 'customer-signin',
              connectUrl: facebookConnectUrl(subdomain, channelId),
            },
          }
        : { error: `Channel ${input.facebook.channel} missing` }),
    });
  }

  const failed = steps.some((s) => s.status === 'error');

  res.status(failed ? 207 : 200).json({ ok: !failed, steps });
};

/** GET /provision — current brand, channels, pipelines and mail (no secrets). */
export const getProvisionState = async (req: Request, res: Response) => {
  try {
    const subdomain = getSubdomain(req);

    const [brands, frontline] = await Promise.all([
      call(subdomain, 'core', 'query', 'brands', 'find', { query: {} }),
      call(subdomain, 'frontline', 'query', 'mailProvision', 'snapshot'),
    ]);

    res.json({
      brands: (brands ?? []).map(
        (b: { _id: string; name: string; code?: string }) => ({
          _id: b._id,
          name: b.name,
          code: b.code,
        }),
      ),
      ...frontline,
    });
  } catch (e) {
    res.status(500).json({ error: errorText(e) });
  }
};
