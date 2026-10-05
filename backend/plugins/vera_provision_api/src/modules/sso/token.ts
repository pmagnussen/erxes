import { createPublicKey, JsonWebKey, KeyObject } from 'node:crypto';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { authCookieOptions, getEnv } from 'erxes-api-shared/utils';
import {
  createErxesSession,
  findErxesUser,
  SESSION_TTL_SECONDS,
} from '@/sso/session';

/**
 * POST /sso/token {token} — the vera.fo Tenant.CRM wrapper (apps.<domain>/crm,
 * embedded in the tenant portal) hands over the user's Keycloak access token.
 * We verify it against THIS tenant's realm (VERA_SSO_ISSUER, via JWKS) and set
 * the normal erxes `auth-token` cookie, so the wrapper can then frame erxes
 * and erxes also works when opened directly in a new tab.
 * CORS: only https origins on the same registrable domain as DOMAIN.
 */
interface IJwk extends JsonWebKey {
  kid?: string;
  use?: string;
}

const JWKS_TTL_MS = 10 * 60 * 1000;
let jwks: { at: number; keys: Map<string, KeyObject> } | null = null;

const loadKeys = async (issuer: string, force: boolean) => {
  if (!force && jwks && Date.now() - jwks.at < JWKS_TTL_MS) {
    return jwks.keys;
  }
  const r = await fetch(`${issuer}/protocol/openid-connect/certs`);
  if (!r.ok) {
    throw new Error(`jwks ${r.status}`);
  }
  const body = (await r.json()) as { keys: IJwk[] };
  const keys = new Map<string, KeyObject>();
  for (const k of body.keys) {
    if (k.kty === 'RSA' && k.use !== 'enc' && k.kid) {
      keys.set(k.kid, createPublicKey({ key: k, format: 'jwk' }));
    }
  }
  jwks = { at: Date.now(), keys };
  return keys;
};

const registrable = (host: string) => host.split('.').slice(-2).join('.');

const allowedOrigin = (req: Request) => {
  const origin = String(req.headers.origin || '');
  try {
    const o = new URL(origin);
    const d = new URL(getEnv({ name: 'DOMAIN' }));
    return o.protocol === 'https:' &&
      registrable(o.hostname) === registrable(d.hostname)
      ? origin
      : '';
  } catch {
    return '';
  }
};

const applyCors = (req: Request, res: Response) => {
  const origin = allowedOrigin(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  return !!origin;
};

export const ssoTokenOptions = (req: Request, res: Response) => {
  applyCors(req, res);
  res.status(204).end();
};

const verifyKeycloakToken = async (token: string, issuer: string) => {
  const kid = String(jwt.decode(token, { complete: true })?.header?.kid || '');
  let keys = await loadKeys(issuer, false);
  if (!keys.has(kid)) {
    keys = await loadKeys(issuer, true);
  }
  const key = keys.get(kid);
  if (!key) {
    throw new Error('unknown kid');
  }
  return jwt.verify(token, key, { algorithms: ['RS256'], issuer }) as {
    email?: string;
  };
};

export const ssoToken = async (req: Request, res: Response) => {
  if (!applyCors(req, res)) {
    res.status(403).json({ error: 'origin' });
    return;
  }
  const issuer = getEnv({ name: 'VERA_SSO_ISSUER' }).replace(/\/$/, '');
  if (!issuer) {
    res.status(404).json({ error: 'sso_off' });
    return;
  }
  const body = req.body as { token?: unknown } | undefined;
  const token = typeof body?.token === 'string' ? body.token : '';

  let email = '';
  try {
    const claims = await verifyKeycloakToken(token, issuer);
    email = String(claims.email || '').trim().toLowerCase();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }
  if (!email.includes('@')) {
    res.status(401).json({ error: 'no_email' });
    return;
  }

  try {
    const user = await findErxesUser(req, email);
    if (!user?._id) {
      res.status(403).json({ error: 'no_user', email });
      return;
    }
    const erxesToken = await createErxesSession(user);
    // SameSite=None: the cookie is set from inside the portal's iframe chain.
    res.cookie(
      'auth-token',
      erxesToken,
      authCookieOptions({
        sameSite: 'none',
        expires: SESSION_TTL_SECONDS * 1000,
      }),
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'session' });
  }
};
