import express, { Router } from 'express';
import { getProvisionState, initWorkspace } from '@/provision/controller';
import { requireProvisionToken } from '@/provision/auth';
import { syncProducts } from '@/provision/products';

import { ssoCallback, ssoStart } from '@/sso/controller';
import { ssoToken, ssoTokenOptions } from '@/sso/token';

export const router: Router = express.Router();

router.get('/sso/start', ssoStart);
router.get('/sso/callback', ssoCallback);
router.options('/sso/token', ssoTokenOptions);
router.post('/sso/token', ssoToken);

router.use('/provision', requireProvisionToken);
router.get('/provision', getProvisionState);
router.post('/provision/init', initWorkspace);
router.post('/provision/products', syncProducts);
