import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { readAttachmentBytes } from '@/integrations/mail/utils/attachments';
import { addressDomain } from '@/integrations/mail/utils/address';
import { describeError } from '@/integrations/mail/utils/errors';
import { debugError } from '@/integrations/mail/debuggers';
import { appendToSentMailbox } from '@/integrations/mail/utils/external/imap';
import { readServerPassword } from '@/integrations/mail/utils/external/settings';
import { buildReactionMime } from '@/integrations/mail/utils/reactions';
import {
  buildAutomationHeaders,
  MailSendError,
  toPlainText,
} from '@/integrations/mail/utils/transports/common';
import {
  IMailTransport,
  IMailTransportOutcome,
  ISendMailInput,
} from '@/integrations/mail/utils/transports/types';

const SMTP_TIMEOUT_MS = 60 * 1000;

const RETRYABLE_CODES = new Set([
  'ECONNECTION',
  'ETIMEDOUT',
  'ESOCKET',
  'EDNS',
  'ECONNRESET',
]);

interface ISmtpError {
  code?: string;
  responseCode?: number;
}

const toSendFailure = (error: unknown) => {
  if (error instanceof MailSendError) {
    return error;
  }

  const { code, responseCode } = (error ?? {}) as ISmtpError;

  const retryable =
    (code !== undefined && RETRYABLE_CODES.has(code)) ||
    (responseCode !== undefined && responseCode >= 400 && responseCode < 500);

  const permanent = responseCode !== undefined && responseCode >= 500;

  return new MailSendError(
    `The mail server refused the message: ${describeError(error)}`,
    permanent ? false : retryable || responseCode === undefined,
  );
};

export const createSmtpConnection = (
  subdomain: string,
  integration: IMailIntegrationDocument,
) => {
  const smtp = integration.smtp;

  if (!smtp?.host) {
    throw new MailSendError('This inbox has no SMTP server configured', false);
  }

  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: !smtp.secure,
    auth: { user: smtp.user, pass: readServerPassword(subdomain, smtp) },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  } as SMTPTransport.Options);
};

const toMailAttachments = async (
  subdomain: string,
  input: ISendMailInput,
): Promise<Mail.Attachment[]> =>
  await Promise.all(
    (input.attachments ?? [])
      .filter((attachment) => attachment.url)
      .map(async (attachment) => {
        const filename = attachment.name || 'attachment';

        const content = await readAttachmentBytes(
          subdomain,
          attachment.url as string,
        ).catch((error: unknown) => {
          throw new MailSendError(
            `The attachment "${filename}" could not be read back for sending: ${describeError(
              error,
            )}`,
            false,
          );
        });

        return {
          filename,
          content,
          contentType: attachment.type || 'application/octet-stream',
          contentDisposition: attachment.disposition ?? 'attachment',
          ...(attachment.contentId ? { cid: attachment.contentId } : {}),
        };
      }),
  );

const buildMessage = async (
  subdomain: string,
  input: ISendMailInput,
): Promise<Mail.Options> => ({
  messageId: input.messageId,
  from: input.fromName
    ? { name: input.fromName, address: input.from }
    : input.from,
  to: input.to,
  cc: input.cc?.length ? input.cc : undefined,
  bcc: input.bcc?.length ? input.bcc : undefined,
  replyTo: input.replyTo || undefined,
  subject: input.subject ?? '',
  html: input.html || undefined,
  text: toPlainText(input.html) || undefined,
  inReplyTo: input.inReplyTo,
  references: input.references?.length ? input.references : undefined,
  headers: buildAutomationHeaders(input),
  attachments: await toMailAttachments(subdomain, input),
});

const renderRaw = (message: Mail.Options) =>
  new Promise<Buffer>((resolve, reject) => {
    nodemailer
      .createTransport({ streamTransport: true, buffer: true })
      .sendMail(message, (error, info) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(info.message as Buffer);
      });
  });

/**
 * Sends through the inbox's own SMTP server. The server owns the mailbox, so
 * the message is also appended to its Sent folder: that keeps the thread
 * visible to anyone who opens the same mailbox in a mail client.
 */
export const createSmtpTransport = (
  subdomain: string,
  integration: IMailIntegrationDocument,
): IMailTransport => ({
  name: integration.smtp?.host ?? 'SMTP',
  provider: 'custom',
  domain: addressDomain(integration.address),

  async send(input: ISendMailInput): Promise<IMailTransportOutcome> {
    const message: Mail.Options = input.reactionEmoji
      ? {
          envelope: { from: input.from, to: input.to.slice(0, 1) },
          raw: buildReactionMime(input),
        }
      : await buildMessage(subdomain, input);

    const connection = createSmtpConnection(subdomain, integration);

    try {
      const info = await connection.sendMail(message);

      const raw = message.raw
        ? Buffer.from(String(message.raw))
        : await renderRaw(message);

      await appendToSentMailbox(subdomain, integration, raw).catch((e) =>
        debugError(
          `Sent ${input.messageId} but could not file it in the Sent folder:`,
          e,
        ),
      );

      return {
        providerMessageId: info.messageId || input.messageId,
        delivered: (info.accepted ?? []).map(String),
        bounced: (info.rejected ?? []).map(String),
        queued: [],
      };
    } catch (e) {
      throw toSendFailure(e);
    } finally {
      connection.close();
    }
  },
});
