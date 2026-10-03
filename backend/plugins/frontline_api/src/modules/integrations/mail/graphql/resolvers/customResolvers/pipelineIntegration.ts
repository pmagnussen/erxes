import { IContext } from '~/connectionResolvers';
import { IMailIntegrationDocument } from '@/integrations/mail/@types/integration';
import { isAwaitingForwardVerification } from '@/integrations/mail/utils/forwardVerification';

export const MailPipelineIntegration = {
  provider({ provider }: IMailIntegrationDocument) {
    return provider || 'cloudflare';
  },

  // Passwords never leave the server; the form shows "saved" instead.
  imap({ imap }: IMailIntegrationDocument) {
    if (!imap?.host) {
      return null;
    }

    return {
      host: imap.host,
      port: imap.port,
      secure: imap.secure,
      user: imap.user,
      mailbox: imap.mailbox,
      sentMailbox: imap.sentMailbox,
      lastSyncedAt: imap.lastSyncedAt,
      hasPassword: Boolean(imap.password),
    };
  },

  smtp({ smtp }: IMailIntegrationDocument) {
    if (!smtp?.host) {
      return null;
    }

    const { password, ...visible } = smtp;

    return { ...visible, hasPassword: Boolean(password) };
  },

  awaitingForwardVerification(integration: IMailIntegrationDocument) {
    return isAwaitingForwardVerification(integration);
  },

  async statusId(
    { statusId, pipelineId }: IMailIntegrationDocument,
    _args: undefined,
    { models }: IContext,
  ) {
    if (!statusId || !pipelineId) {
      return '';
    }

    const status = await models.Status.exists({ _id: statusId, pipelineId });

    return status ? statusId : '';
  },
};
