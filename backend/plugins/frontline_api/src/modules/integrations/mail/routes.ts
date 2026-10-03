import express, { Router } from 'express';
import { receiveMailMessage } from '@/integrations/mail/controller/receiveMessage';
import { debugError } from '@/integrations/mail/debuggers';
import {
  getInbox,
  getPipelineMail,
  listProvisioned,
  removeInbox,
  removePipelineMail,
  requireProvisionToken,
  upsertInbox,
  upsertPipelineMail,
} from '@/integrations/mail/controller/provision';

export const router: Router = express.Router();

router.post('/receive', async (req, res) => {
  try {
    await receiveMailMessage(req, res);
  } catch (err) {
    debugError('Failed to handle inbound message:', err);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to handle inbound message' });
    }
  }
});

const provision: Router = express.Router();

provision.use(requireProvisionToken);
provision.get('/', listProvisioned);
provision.put('/inboxes', upsertInbox);
provision.get('/inboxes/:address', getInbox);
provision.delete('/inboxes/:address', removeInbox);
provision.get('/pipelines/:pipelineId', getPipelineMail);
provision.put('/pipelines/:pipelineId', upsertPipelineMail);
provision.delete('/pipelines/:pipelineId', removePipelineMail);

router.use('/provision', provision);
