import { Schema } from 'mongoose';
import { mongooseStringRandomId } from 'erxes-api-shared/utils';
import { MAIL_HEALTH_STATUSES } from '@/integrations/mail/constants';

const forwardVerificationSchema = new Schema(
  {
    from: { type: String, label: 'Address the confirmation came from' },
    subject: { type: String, label: 'Subject of the confirmation' },
    code: { type: String, label: 'Confirmation code found in the message' },
    link: { type: String, label: 'Confirmation link found in the message' },
    excerpt: { type: String, label: 'Readable start of the message body' },
    receivedAt: { type: Date, label: 'When the confirmation arrived' },
  },
  { _id: false },
);

const serverFields = {
  host: { type: String, label: 'Server host name' },
  port: { type: Number, label: 'Server port' },
  secure: { type: Boolean, label: 'Implicit TLS on connect' },
  user: { type: String, label: 'Login user name' },
  password: { type: String, label: 'Login password, encrypted at rest' },
};

const smtpSettingsSchema = new Schema(serverFields, { _id: false });

const imapSettingsSchema = new Schema(
  {
    ...serverFields,
    mailbox: { type: String, label: 'Mailbox read for inbound mail' },
    sentMailbox: {
      type: String,
      label: 'Mailbox a copy of every reply is appended to',
    },
    uidValidity: { type: String, label: 'UIDVALIDITY the cursor belongs to' },
    lastUid: { type: Number, label: 'Highest UID already imported' },
    lastSyncedAt: { type: Date, label: 'When the mailbox was last read' },
  },
  { _id: false },
);

export const mailIntegrationSchema = new Schema({
  _id: mongooseStringRandomId,
  provider: {
    type: String,
    label:
      'Where mail is received and sent: cloudflare (routed) or imap (an external IMAP/SMTP server). Absent means cloudflare.',
  },
  imap: { type: imapSettingsSchema, label: 'External IMAP server' },
  smtp: { type: smtpSettingsSchema, label: 'External SMTP server' },
  inboxId: {
    type: String,
    unique: true,
    sparse: true,
    label: 'Inbox integration id, set only on channel inboxes',
  },
  pipelineId: {
    type: String,
    unique: true,
    sparse: true,
    label: 'Ticket pipeline id, set only on pipeline addresses',
  },
  statusId: {
    type: String,
    label:
      "Status a new mail ticket opens in, empty means the pipeline's first status",
  },
  name: {
    type: String,
    label: 'Display name of a pipeline address',
  },
  address: {
    type: String,
    unique: true,
    label: 'Address inbound mail is routed to',
  },
  forwardFrom: { type: String, label: 'Address the tenant forwards from' },
  forwardPendingAt: {
    type: Date,
    label:
      'When forwarding setup began. While this is inside the verification window a confirmation message is held here instead of opening a ticket.',
  },
  forwardVerification: {
    type: forwardVerificationSchema,
    label: 'Confirmation message held back from the ticket path',
  },
  senderName: {
    type: String,
    label: 'Display name on replies, empty means the inbox name',
  },
  healthStatus: { type: String, default: MAIL_HEALTH_STATUSES.HEALTHY },
  error: { type: String, default: '' },
  disabledAt: {
    type: Date,
    label:
      'When the address was disconnected. Absent means connected, so rows written before this field stay connected without a backfill.',
  },
});
