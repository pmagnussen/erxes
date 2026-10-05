import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { authCookieOptions, getEnv } from 'erxes-api-shared/utils';
import {
  createErxesSession,
  findErxesUser,
  SESSION_TTL_SECONDS,
} from '@/sso/session';

/**
 * Keycloak SSO: a user already signed in to their vera.fo realm lands in erxes
 * without typing anything. OIDC authorization-code + PKCE with prompt=none, so
 * no Keycloak page is ever shown; without a Keycloak session we fall back to
 * the normal erxes login page (?sso=none).
 *
 * Env: VERA_SSO_ISSUER (https://auth.vera.fo/realms/<t>-realm),
 * VERA_SSO_CLIENT_ID, VERA_SSO_CLIENT_SECRET, DOMAIN, JWT_TOKEN_SECRET.
 */
const STATE_COOKIE = 'vera-sso';
const CALLBACK_PATH = '/gateway/pl:veraprovision/sso/callback';

interface ISsoConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  domain: string;
}

interface ISsoState {
  state: string;
  verifier: string;
  redirect: string;
}

const getConfig = (): ISsoConfig | null => {
  const issuer = getEnv({ name: 'VERA_SSO_ISSUER' }).replace(/\/$/, '');
  const clientId = getEnv({ name: 'VERA_SSO_CLIENT_ID' });
  const clientSecret = getEnv({ name: 'VERA_SSO_CLIENT_SECRET' });
  const domain = getEnv({ name: 'DOMAIN' }).replace(/\/$/, '');

  if (!issuer || !clientId || !domain) {
    return null;
  }

  return { issuer, clientId, clientSecret, domain };
};

const b64url = (buf: Buffer) => buf.toString('base64url');

const safeRedirect = (value: unknown) => {
  const v = typeof value === 'string' ? value : '/';
  return v.startsWith('/') && !v.startsWith('//') ? v : '/';
};

const readCookie = (req: Request, name: string) => {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return '';
};

const fail = (res: Response, config: ISsoConfig | null, reason: string) => {
  const base = config?.domain || '';
  res.clearCookie(STATE_COOKIE, { path: CALLBACK_PATH });
  res.redirect(`${base}/login?sso=${encodeURIComponent(reason)}`);
};

/** GET /sso/start?redirect=/path */
export const ssoStart = (req: Request, res: Response) => {
  const config = getConfig();
  if (!config) {
    // SSO env not set for this tenant: back to the normal login form.
    const domain = getEnv({ name: 'DOMAIN' }).replace(/\/$/, '');
    res.redirect(`${domain}/login?sso=off`);
    return;
  }

  const state = b64url(randomBytes(16));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const payload: ISsoState = {
    state,
    verifier,
    redirect: safeRedirect(req.query.redirect),
  };

  res.cookie(STATE_COOKIE, b64url(Buffer.from(JSON.stringify(payload))), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: CALLBACK_PATH,
    maxAge: 5 * 60 * 1000,
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'openid email',
    redirect_uri: config.domain + CALLBACK_PATH,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: req.query.interactive === '1' ? 'login' : 'none',
  });

  res.redirect(`${config.issuer}/protocol/openid-connect/auth?${params}`);
};

const sameString = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET /sso/callback?code&state | ?error */
export const ssoCallback = async (req: Request, res: Response) => {
  const config = getConfig();
  if (!config) {
    res.status(404).send('SSO not configured');
    return;
  }

  if (req.query.error) {
    fail(res, config, 'none');
    return;
  }

  let saved: ISsoState;
  try {
    saved = JSON.parse(
      Buffer.from(readCookie(req, STATE_COOKIE), 'base64url').toString(),
    );
  } catch {
    fail(res, config, 'state');
    return;
  }

  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  if (!code || !saved?.state || !sameString(state, saved.state)) {
    fail(res, config, 'state');
    return;
  }

  try {
    const tokenRes = await fetch(
      `${config.issuer}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.domain + CALLBACK_PATH,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code_verifier: saved.verifier,
        }),
      },
    );
    if (!tokenRes.ok) {
      throw new Error(`token ${tokenRes.status}`);
    }
    const { access_token: accessToken } = (await tokenRes.json()) as {
      access_token?: string;
    };

    // Identity straight from the issuer over TLS: no local JWT verification needed.
    const infoRes = await fetch(
      `${config.issuer}/protocol/openid-connect/userinfo`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!infoRes.ok) {
      throw new Error(`userinfo ${infoRes.status}`);
    }
    const info = (await infoRes.json()) as {
      email?: string;
      email_verified?: boolean;
    };
    const email = String(info.email || '').toLowerCase();
    if (!email) {
      fail(res, config, 'noemail');
      return;
    }

    const user = await findErxesUser(req, email);
    if (!user?._id) {
      fail(res, config, 'nouser');
      return;
    }

    const token = await createErxesSession(user);

    res.clearCookie(STATE_COOKIE, { path: CALLBACK_PATH });
    res.cookie(
      'auth-token',
      token,
      authCookieOptions({ sameSite: 'none', expires: SESSION_TTL_SECONDS * 1000 }),
    );
    res.redirect(config.domain + saved.redirect);
  } catch {
    fail(res, config, 'error');
  }
};
