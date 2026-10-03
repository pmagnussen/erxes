import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { getEnv } from 'erxes-api-shared/utils';

const PREFIX = 'enc:v1:';

const readKey = (subdomain: string) => {
  const secret = getEnv({
    name: 'MAIL_CREDENTIALS_KEY',
    defaultValue: '',
    subdomain,
  }).trim();

  if (!secret) {
    throw new Error(
      'MAIL_CREDENTIALS_KEY is not configured, so mail server passwords cannot be stored',
    );
  }

  return createHash('sha256').update(secret, 'utf8').digest();
};

export const isEncryptedSecret = (value?: string) =>
  Boolean(value?.startsWith(PREFIX));

export const encryptSecret = (subdomain: string, plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', readKey(subdomain), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

  return `${PREFIX}${Buffer.concat([iv, cipher.getAuthTag(), body]).toString(
    'base64',
  )}`;
};

export const decryptSecret = (subdomain: string, stored?: string) => {
  if (!stored) {
    return '';
  }

  if (!isEncryptedSecret(stored)) {
    return stored;
  }

  const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    readKey(subdomain),
    raw.subarray(0, 12),
  );

  decipher.setAuthTag(raw.subarray(12, 28));

  return Buffer.concat([
    decipher.update(raw.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
};
