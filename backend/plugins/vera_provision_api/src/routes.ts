import express, { Router } from 'express';
import { getProvisionState, initWorkspace } from '@/provision/controller';
import { requireProvisionToken } from '@/provision/auth';

import { ssoCallback, ssoStart } from '@/sso/controller';

export const router: Router = express.Router();

router.get('/sso/start', ssoStart);
router.get('/sso/callback', ssoCallback);

router.use('/provision', requireProvisionToken);
router.get('/provision', getProvisionState);
router.post('/provision/init', initWorkspace);
