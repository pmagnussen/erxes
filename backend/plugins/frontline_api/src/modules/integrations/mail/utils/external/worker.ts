import {
  createMQWorkerWithListeners,
  redis,
  sendWorkerQueue,
} from 'erxes-api-shared/utils';
import { generateModels } from '~/connectionResolvers';
import { debugError } from '@/integrations/mail/debuggers';
import { describeError } from '@/integrations/mail/utils/errors';
import { syncImapMailbox } from '@/integrations/mail/utils/external/imap';
import {
  ensureImapIdle,
  stopAllImapIdle,
  stopImapIdle,
} from '@/integrations/mail/utils/external/idle';
import { isExternalIntegration } from '@/integrations/mail/utils/external/settings';

export const MAIL_IMAP_QUEUE = 'mail-imap-sync';

// IDLE delivers new mail within seconds; this sweep only backs it up and
// (re)claims IDLE ownership, e.g. after the replica holding it died.
const SYNC_EVERY_MS = 60 * 1000;

interface IImapSyncJob {
  subdomain: string;
  integrationId: string;
}

const queue = () => sendWorkerQueue('frontline', MAIL_IMAP_QUEUE);

const schedulerId = ({ subdomain, integrationId }: IImapSyncJob) =>
  `mail-imap-${subdomain}-${integrationId}`;

/**
 * One repeating job per IMAP inbox. Upserting keeps a single scheduler per
 * inbox however often settings are saved, and the job reads the integration
 * fresh every run, so a disconnected or deleted inbox stops itself.
 */
export const scheduleImapSync = async (job: IImapSyncJob) => {
  await queue().upsertJobScheduler(
    schedulerId(job),
    { every: SYNC_EVERY_MS },
    {
      name: MAIL_IMAP_QUEUE,
      data: job,
      opts: { removeOnComplete: true, removeOnFail: true },
    },
  );

  await triggerImapSync(job);
};

// A fixed job id collapses a burst of IDLE notifications into one pending
// sync; the sync itself picks up every UID past the cursor.
export const triggerImapSync = async (job: IImapSyncJob) => {
  await queue().add(MAIL_IMAP_QUEUE, job, {
    jobId: `${schedulerId(job)}-now`,
    removeOnComplete: true,
    removeOnFail: true,
  });
};

export const unscheduleImapSync = async (job: IImapSyncJob) => {
  await stopImapIdle(job.subdomain, job.integrationId);

  try {
    await queue().removeJobScheduler(schedulerId(job));
  } catch (e) {
    debugError('Could not stop IMAP sync:', e);
  }
};

export const runImapSync = async ({
  subdomain,
  integrationId,
}: IImapSyncJob) => {
  const models = await generateModels(subdomain);

  const integration = await models.MailIntegrations.findOne({
    _id: integrationId,
  });

  if (
    !integration ||
    integration.disabledAt ||
    !isExternalIntegration(integration)
  ) {
    await unscheduleImapSync({ subdomain, integrationId });

    return { stopped: true };
  }

  await ensureImapIdle(subdomain, integrationId, triggerImapSync).catch((e) =>
    debugError('Could not start IMAP IDLE:', e),
  );

  try {
    return await syncImapMailbox(models, subdomain, integration);
  } catch (e) {
    await models.MailIntegrations.markUnhealthy(
      integration._id,
      `Could not read the mailbox: ${describeError(e)}`,
    );

    throw e;
  }
};

export const startMailImapWorker = () => {
  createMQWorkerWithListeners(
    'frontline',
    MAIL_IMAP_QUEUE,
    async (job) => await runImapSync(job.data as IImapSyncJob),
    redis,
    () => undefined,
    { concurrency: 5 },
  );

  process.once('SIGTERM', () => {
    stopAllImapIdle().catch(() => undefined);
  });
};
