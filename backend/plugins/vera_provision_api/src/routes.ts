import express, { Router } from 'express';
import { getProvisionState, initWorkspace } from '@/provision/controller';
import { requireProvisionToken } from '@/provision/auth';

export const router: Router = express.Router();

router.use('/provision', requireProvisionToken);
router.get('/provision', getProvisionState);
router.post('/provision/init', initWorkspace);
