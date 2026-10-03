import {
  IMailImapSettings,
  IMailIntegrationDocument,
  IMailServerSettings,
} from '@/integrations/mail/@types/integration';
import { isEmailAddress } from '@/integrations/mail/utils/address';
import {
  decryptSecret,
  encryptSecret,
} from '@/integrations/mail/utils/external/secrets';

export const MAIL_PROVIDERS = {
  CLOUDFLARE: 'cloudflare',
  IMAP: 'imap',
} as const;

export const DEFAULT_INBOX_MAILBOX = 'INBOX';

export const DEFAULT_SENT_MAILBOX = 'Sent';

export interface IExternalServerInput {
  host?: unknown;
  port?: unknown;
  secure?: unknown;
  user?: unknown;
  password?: unknown;
  mailbox?: unknown;
  sentMailbox?: unknown;
}

export const readExternalAddress = (value: unknown) => {
  const address = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (!isEmailAddress(address)) {
    throw new Error('A valid mailbox address is required');
  }

  return address;
};

export const isExternalIntegration = (
  integration?: Pick<IMailIntegrationDocument, 'provider'> | null,
) => integration?.provider === MAIL_PROVIDERS.IMAP;

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const readServer = (
  label: string,
  input: IExternalServerInput | undefined,
  previous: IMailServerSettings | undefined,
  defaults: { port: number; secure: boolean },
) => {
  const host = text(input?.host) || previous?.host || '';
  const user = text(input?.user) || previous?.user || '';
  const port = Number(input?.port ?? previous?.port ?? defaults.port);

  if (!host) {
    throw new Error(`${label} host is required`);
  }

  if (!user) {
    throw new Error(`${label} user name is required`);
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} port must be between 1 and 65535`);
  }

  return {
    host,
    user,
    port,
    secure:
      typeof input?.secure === 'boolean'
        ? input.secure
        : previous?.secure ?? defaults.secure,
  };
};

const readPassword = (
  subdomain: string,
  label: string,
  input: IExternalServerInput | undefined,
  previous: IMailServerSettings | undefined,
) => {
  const password = typeof input?.password === 'string' ? input.password : '';

  if (password) {
    return encryptSecret(subdomain, password);
  }

  if (previous?.password) {
    return previous.password;
  }

  throw new Error(`${label} password is required`);
};

/**
 * Builds the stored IMAP/SMTP settings from what the form sent. An empty
 * password keeps the stored one, so editing a host never asks for it again,
 * and changing the IMAP server or mailbox resets the UID cursor.
 */
export const normalizeExternalSettings = (
  subdomain: string,
  input: { imap?: IExternalServerInput; smtp?: IExternalServerInput },
  previous?: Pick<IMailIntegrationDocument, 'imap' | 'smtp'> | null,
): { imap: IMailImapSettings; smtp: IMailServerSettings } => {
  const imapServer = readServer('IMAP', input.imap, previous?.imap, {
    port: 993,
    secure: true,
  });

  const mailbox =
    text(input.imap?.mailbox) ||
    previous?.imap?.mailbox ||
    DEFAULT_INBOX_MAILBOX;

  const sameMailbox =
    previous?.imap?.host === imapServer.host &&
    previous?.imap?.user === imapServer.user &&
    (previous?.imap?.mailbox || DEFAULT_INBOX_MAILBOX) === mailbox;

  const imap: IMailImapSettings = {
    ...imapServer,
    password: readPassword(subdomain, 'IMAP', input.imap, previous?.imap),
    mailbox,
    sentMailbox:
      text(input.imap?.sentMailbox) ||
      previous?.imap?.sentMailbox ||
      DEFAULT_SENT_MAILBOX,
    ...(sameMailbox
      ? {
          uidValidity: previous?.imap?.uidValidity,
          lastUid: previous?.imap?.lastUid,
          lastSyncedAt: previous?.imap?.lastSyncedAt,
        }
      : {}),
  };

  const smtpServer = readServer('SMTP', input.smtp, previous?.smtp, {
    port: 465,
    secure: true,
  });

  const smtp: IMailServerSettings = {
    ...smtpServer,
    password: readPassword(subdomain, 'SMTP', input.smtp, previous?.smtp),
  };

  return { imap, smtp };
};

export const readServerPassword = (
  subdomain: string,
  settings?: IMailServerSettings,
) => decryptSecret(subdomain, settings?.password);
