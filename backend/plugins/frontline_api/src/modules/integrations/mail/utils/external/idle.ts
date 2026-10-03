import { randomUUID } from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { redis } from 'erxes-api-shared/utils';
import { generateModels } from '~/connectionResolvers';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { debugError } from '@/integrations/mail/debuggers';
import { createImapClient } from '@/integrations/mail/utils/external/imap';
import {
  DEFAULT_INBOX_MAILBOX,
  isExternalIntegration,
} from '@/integrations/mail/utils/external/settings';

const LOCK_TTL_MS = 60 * 1000;

const RENEW_EVERY_MS = 20 * 1000;

const MAX_BACKOFF_MS = 5 * 60 * 1000;

// Release/extend only while the key still holds our token, so a replica whose
// lock already expired can never take a lock another replica now owns.
const RENEW_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`;

const RELEASE_SCRIPT = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

export type TImapIdleTrigger = (job: {
  subdomain: string;
  integrationId: string;
}) => Promise<void>;

interface IWatcher {
  subdomain: string;
  integrationId: string;
  fingerprint: string;
  token: string;
  client?: ImapFlow;
  renewTimer?: NodeJS.Timeout;
  retryTimer?: NodeJS.Timeout;
  failures: number;
  stopped: boolean;
}

const watchers = new Map<string, IWatcher>();

const watcherKey = (subdomain: string, integrationId: string) =>
  `${subdomain}:${integrationId}`;

const lockKey = (subdomain: string, integrationId: string) =>
  `mail-imap-idle:${subdomain}:${integrationId}`;

// Anything that changes which mailbox is watched or how we sign in to it.
export const imapFingerprint = (integration: IMailIntegrationDocument) => {
  const imap = integration.imap;

  return [
    imap?.host,
    imap?.port,
    imap?.secure,
    imap?.user,
    imap?.password,
    imap?.mailbox || DEFAULT_INBOX_MAILBOX,
  ].join('|');
};

const backoff = (failures: number) =>
  Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(failures, 10));

const loadWatchable = async (subdomain: string, integrationId: string) => {
  const models = await generateModels(subdomain);
  const integration = await models.MailIntegrations.findOne({
    _id: integrationId,
  });

  return integration &&
    !integration.disabledAt &&
    isExternalIntegration(integration)
    ? integration
    : null;
};

const stopWatcher = async (watcher: IWatcher) => {
  watcher.stopped = true;
  watchers.delete(watcherKey(watcher.subdomain, watcher.integrationId));

  clearInterval(watcher.renewTimer);
  clearTimeout(watcher.retryTimer);

  const client = watcher.client;
  watcher.client = undefined;

  await client?.logout().catch(() => client.close());

  await redis
    .eval(
      RELEASE_SCRIPT,
      1,
      lockKey(watcher.subdomain, watcher.integrationId),
      watcher.token,
    )
    .catch(() => undefined);
};

const connect = async (
  watcher: IWatcher,
  integration: IMailIntegrationDocument,
  trigger: TImapIdleTrigger,
) => {
  if (watcher.stopped) {
    return;
  }

  const job = {
    subdomain: watcher.subdomain,
    integrationId: watcher.integrationId,
  };

  const scheduleReconnect = () => {
    if (watcher.stopped || watcher.retryTimer) {
      return;
    }

    watcher.client = undefined;
    watcher.failures += 1;

    watcher.retryTimer = setTimeout(async () => {
      watcher.retryTimer = undefined;

      const fresh = await loadWatchable(
        watcher.subdomain,
        watcher.integrationId,
      ).catch(() => null);

      if (!fresh || imapFingerprint(fresh) !== watcher.fingerprint) {
        await stopWatcher(watcher);
        return;
      }

      await connect(watcher, fresh, trigger);
    }, backoff(watcher.failures));
  };

  try {
    const client = createImapClient(watcher.subdomain, integration);

    client.on('error', (e) => debugError('IMAP IDLE connection error:', e));
    client.on('close', scheduleReconnect);

    // New mail announced while idling: hand it to the same import the
    // scheduler runs, so ordering, cursor and dedupe stay in one place.
    client.on('exists', () => {
      trigger(job).catch((e) => debugError('IMAP IDLE trigger failed:', e));
    });

    watcher.client = client;

    await client.connect();
    await client.mailboxOpen(
      integration.imap?.mailbox || DEFAULT_INBOX_MAILBOX,
      { readOnly: true },
    );

    watcher.failures = 0;

    // Catch whatever arrived while we were disconnected.
    await trigger(job);
  } catch (e) {
    debugError(
      `IMAP IDLE could not watch ${integration.address}, retrying:`,
      e,
    );

    const client = watcher.client;

    if (client) {
      client.removeAllListeners('close');
      client.close();
    }

    scheduleReconnect();
  }
};

/**
 * Makes sure exactly one replica holds an IDLE connection to the inbox's
 * mailbox. Safe to call as often as needed: it is a no-op while this process
 * already watches the current settings, restarts the watch when the settings
 * changed, and quietly does nothing while another replica holds the lock.
 */
export const ensureImapIdle = async (
  subdomain: string,
  integrationId: string,
  trigger: TImapIdleTrigger,
) => {
  const key = watcherKey(subdomain, integrationId);
  const integration = await loadWatchable(subdomain, integrationId);
  const current = watchers.get(key);

  if (!integration) {
    if (current) {
      await stopWatcher(current);
    }
    return false;
  }

  const fingerprint = imapFingerprint(integration);

  if (current && current.fingerprint === fingerprint) {
    return true;
  }

  const token = current?.token ?? randomUUID();

  if (current) {
    await stopWatcher(current);
  }

  const acquired = await redis.set(
    lockKey(subdomain, integrationId),
    token,
    'PX',
    LOCK_TTL_MS,
    'NX',
  );

  if (!acquired) {
    return false;
  }

  const watcher: IWatcher = {
    subdomain,
    integrationId,
    fingerprint,
    token,
    failures: 0,
    stopped: false,
  };

  watchers.set(key, watcher);

  watcher.renewTimer = setInterval(async () => {
    const renewed = await redis
      .eval(
        RENEW_SCRIPT,
        1,
        lockKey(subdomain, integrationId),
        token,
        String(LOCK_TTL_MS),
      )
      .catch(() => 0);

    if (!renewed) {
      await stopWatcher(watcher);
    }
  }, RENEW_EVERY_MS);

  await connect(watcher, integration, trigger);

  return true;
};

export const stopImapIdle = async (
  subdomain: string,
  integrationId: string,
) => {
  const current = watchers.get(watcherKey(subdomain, integrationId));

  if (current) {
    await stopWatcher(current);
  }
};

export const stopAllImapIdle = async () => {
  await Promise.all([...watchers.values()].map(stopWatcher));
};

export const watchedImapInboxes = () => [...watchers.keys()];
