import { timingSafeEqual } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { getEnv } from 'erxes-api-shared/utils';

/**
 * Bearer `VERA_PROVISION_TOKEN` (>= 32 chars). Unset or short = API disabled.
 * Per-tenant HMAC tokens and request signing are planned on top of this.
 */
export const requireProvisionToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const expected = String(getEnv({ name: 'VERA_PROVISION_TOKEN' }) || '');
  const header = String(req.headers.authorization || '');
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';

  const ok =
    expected.length >= 32 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected));

  if (!ok) {
    res.status(401).json({ error: 'Invalid provisioning token' });
    return;
  }

  next();
};
