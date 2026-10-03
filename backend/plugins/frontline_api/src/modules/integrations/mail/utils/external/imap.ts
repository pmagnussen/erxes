import { ImapFlow } from 'imapflow';
import { AddressObject, ParsedMail, simpleParser } from 'mailparser';
import { IModels } from '~/connectionResolvers';
import {
  IInboundAddress,
  IInboundMailPayload,
} from '@/integrations/mail/@types/webhook';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { ingestInboundMail } from '@/integrations/mail/controller/receiveMessage';
import { debugError } from '@/integrations/mail/debuggers';
import { parseTaggedAddress } from '@/integrations/mail/utils/address';
import { MAX_ATTACHMENT_BYTES } from '@/integrations/mail/utils/attachments';
import { describeError } from '@/integrations/mail/utils/errors';
import {
  DEFAULT_INBOX_MAILBOX,
  DEFAULT_SENT_MAILBOX,
  readServerPassword,
} from '@/integrations/mail/utils/external/settings';

const IMAP_TIMEOUT_MS = 60 * 1000;

const MAX_MESSAGES_PER_SYNC = 50;

export interface IImapSyncResult {
  imported: number;
  skipped: number;
  lastUid?: number;
}

export const createImapClient = (
  subdomain: string,
  integration: Pick<IMailIntegrationDocument, 'imap'>,
) => {
  const imap = integration.imap;

  if (!imap?.host) {
    throw new Error('This inbox has no IMAP server configured');
  }

  return new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imap.user, pass: readServerPassword(subdomain, imap) },
    logger: false,
    connectionTimeout: IMAP_TIMEOUT_MS,
    greetingTimeout: IMAP_TIMEOUT_MS,
    socketTimeout: IMAP_TIMEOUT_MS,
  });
};

const withClient = async <T>(
  subdomain: string,
  integration: Pick<IMailIntegrationDocument, 'imap'>,
  work: (client: ImapFlow) => Promise<T>,
) => {
  const client = createImapClient(subdomain, integration);

  client.on('error', (e) => debugError('IMAP connection error:', e));

  await client.connect();

  try {
    return await work(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
};

const toAddresses = (
  value?: AddressObject | AddressObject[],
): IInboundAddress[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((entry) => entry.value)
    .filter((entry) => entry.address)
    .map((entry) => ({
      name: entry.name || undefined,
      address: entry.address,
    }));

const readHeaders = (parsed: ParsedMail) => {
  const headers: Record<string, string> = {};

  for (const line of parsed.headerLines) {
    const value = line.line.slice(line.line.indexOf(':') + 1).trim();

    headers[line.key] = headers[line.key]
      ? `${headers[line.key]}, ${value}`
      : value;
  }

  return headers;
};

const toReferences = (value?: string | string[]) =>
  (Array.isArray(value) ? value : value ? value.split(/\s+/) : []).filter(
    Boolean,
  );

// The mailbox belongs to this inbox, so whichever recipient carries the inbox
// address (or a reply tag on it) is the one the message was delivered to.
const resolveRecipient = (
  integration: IMailIntegrationDocument,
  candidates: IInboundAddress[],
) => {
  const own = integration.address.toLowerCase();

  const tagged = candidates
    .map((entry) => (entry.address ?? '').toLowerCase())
    .find((address) => parseTaggedAddress(address).address === own);

  return tagged || own;
};

export const toInboundPayload = (
  integration: IMailIntegrationDocument,
  parsed: ParsedMail,
  uid: number,
): IInboundMailPayload => {
  const recipients = toAddresses(parsed.to);
  const cc = toAddresses(parsed.cc);
  const bcc = toAddresses(parsed.bcc);
  const headers = readHeaders(parsed);
  const [from] = toAddresses(parsed.from);

  return {
    to: resolveRecipient(integration, [...recipients, ...cc, ...bcc]),
    messageId:
      parsed.messageId ||
      `<imap-${integration._id}-${headers['date'] ?? ''}-${uid}@erxes.local>`,
    inReplyTo: parsed.inReplyTo || undefined,
    references: toReferences(parsed.references),
    from,
    envelopeFrom: headers['return-path']?.replace(/^<|>$/g, '') || undefined,
    recipients,
    cc,
    bcc,
    subject: parsed.subject ?? '',
    html:
      parsed.html ||
      (parsed.textAsHtml ?? '') ||
      (parsed.text ? `<pre>${parsed.text}</pre>` : ''),
    receivedAt: parsed.date?.toISOString(),
    headers,
    attachments: parsed.attachments
      .filter((attachment) => attachment.size <= MAX_ATTACHMENT_BYTES)
      .map((attachment) => ({
        filename: attachment.filename,
        mimeType: attachment.contentType,
        contentId: attachment.contentId?.replace(/^<|>$/g, ''),
        disposition:
          attachment.contentDisposition === 'inline' ? 'inline' : 'attachment',
        content: attachment.content.toString('base64'),
        size: attachment.size,
      })),
  };
};

/**
 * Imports everything that arrived in the inbox mailbox since the last run.
 * The first run of a mailbox (or a UIDVALIDITY change) only sets the cursor,
 * so connecting an existing mailbox never floods the inbox with its history.
 */
export const syncImapMailbox = async (
  models: IModels,
  subdomain: string,
  integration: IMailIntegrationDocument,
): Promise<IImapSyncResult> => {
  const mailbox = integration.imap?.mailbox || DEFAULT_INBOX_MAILBOX;

  return await withClient(subdomain, integration, async (client) => {
    const lock = await client.getMailboxLock(mailbox, { readOnly: true });

    try {
      const status = client.mailbox;

      if (!status) {
        throw new Error(`Mailbox ${mailbox} could not be opened`);
      }

      const uidValidity = String(status.uidValidity);
      const known = integration.imap?.uidValidity === uidValidity;

      if (!known) {
        const lastUid = Math.max(0, status.uidNext - 1);

        await models.MailIntegrations.updateOne(
          { _id: integration._id },
          {
            $set: {
              'imap.uidValidity': uidValidity,
              'imap.lastUid': lastUid,
              'imap.lastSyncedAt': new Date(),
            },
          },
        );

        await models.MailIntegrations.markHealthy(integration._id);

        return { imported: 0, skipped: 0, lastUid };
      }

      let lastUid = integration.imap?.lastUid ?? 0;
      let imported = 0;
      let skipped = 0;

      const uids = (
        (await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })) || []
      )
        .filter((uid) => uid > lastUid)
        .sort((a, b) => a - b)
        .slice(0, MAX_MESSAGES_PER_SYNC);

      for (const uid of uids) {
        const message = await client.fetchOne(
          String(uid),
          { source: true },
          { uid: true },
        );

        if (message && message.source) {
          const parsed = await simpleParser(message.source);
          const result = await ingestInboundMail(
            models,
            subdomain,
            integration,
            toInboundPayload(integration, parsed, uid),
            parseTaggedAddress(
              resolveRecipient(integration, [
                ...toAddresses(parsed.to),
                ...toAddresses(parsed.cc),
              ]),
            ).tag,
          );

          if ('status' in result && result.status === 'ok') {
            imported += 1;
          } else {
            skipped += 1;
          }
        }

        lastUid = uid;

        await models.MailIntegrations.updateOne(
          { _id: integration._id },
          {
            $set: { 'imap.lastUid': lastUid, 'imap.lastSyncedAt': new Date() },
          },
        );
      }

      if (!uids.length) {
        await models.MailIntegrations.updateOne(
          { _id: integration._id },
          { $set: { 'imap.lastSyncedAt': new Date() } },
        );
      }

      await models.MailIntegrations.markHealthy(integration._id);

      return { imported, skipped, lastUid };
    } finally {
      lock.release();
    }
  });
};

export const appendToSentMailbox = async (
  subdomain: string,
  integration: IMailIntegrationDocument,
  raw: Buffer,
) => {
  if (!integration.imap?.host) {
    return;
  }

  const sentMailbox = integration.imap.sentMailbox || DEFAULT_SENT_MAILBOX;

  await withClient(subdomain, integration, async (client) => {
    await client.append(sentMailbox, raw, ['\\Seen']);
  });
};

export type TImapCheck =
  | { ok: true; messages: number }
  | { ok: false; error: string };

export const checkImapConnection = async (
  subdomain: string,
  integration: Pick<IMailIntegrationDocument, 'imap'>,
): Promise<TImapCheck> => {
  const mailbox = integration.imap?.mailbox || DEFAULT_INBOX_MAILBOX;

  try {
    return await withClient(subdomain, integration, async (client) => {
      const status = await client.status(mailbox, { messages: true });

      return { ok: true as const, messages: status.messages ?? 0 };
    });
  } catch (e) {
    return { ok: false as const, error: describeError(e) };
  }
};
