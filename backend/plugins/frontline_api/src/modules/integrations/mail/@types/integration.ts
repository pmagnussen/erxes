import { Document } from 'mongoose';

export interface IMailForwardVerification {
  from?: string;
  subject?: string;
  code?: string;
  link?: string;
  excerpt?: string;
  receivedAt?: Date;
}

export type TMailProvider = 'cloudflare' | 'imap';

export interface IMailServerSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface IMailImapSettings extends IMailServerSettings {
  mailbox?: string;
  sentMailbox?: string;
  uidValidity?: string;
  lastUid?: number;
  lastSyncedAt?: Date;
}

export interface IMailIntegration {
  provider?: TMailProvider;
  imap?: IMailImapSettings;
  smtp?: IMailServerSettings;
  inboxId?: string;
  pipelineId?: string;
  statusId?: string;
  name?: string;
  address: string;
  forwardFrom?: string;
  forwardPendingAt?: Date | null;
  forwardVerification?: IMailForwardVerification | null;
  senderName?: string;
  healthStatus?: string;
  error?: string;
  disabledAt?: Date | null;
}

export interface IMailIntegrationDocument extends IMailIntegration, Document {
  _id: string;
}
