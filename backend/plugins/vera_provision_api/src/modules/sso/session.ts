import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import {
  getEnv,
  getSubdomain,
  redis,
  sendTRPCMessage,
} from 'erxes-api-shared/utils';

export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export interface IErxesUser {
  _id?: string;
  isOwner?: boolean;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Active erxes user whose email matches (case-insensitive). */
export const findErxesUser = async (req: Request, email: string) =>
  (await sendTRPCMessage({
    subdomain: getSubdomain(req),
    pluginName: 'core',
    method: 'query',
    module: 'users',
    action: 'findOne',
    input: {
      query: {
        email: { $regex: `^${escapeRegex(email)}$`, $options: 'i' },
        isActive: { $ne: false },
      },
    },
  })) as IErxesUser | null;

/** Same JWT + redis registration erxes' own login does. */
export const createErxesSession = async (user: IErxesUser) => {
  const token = jwt.sign(
    { user: { _id: user._id, isOwner: !!user.isOwner } },
    getEnv({ name: 'JWT_TOKEN_SECRET' }),
    { expiresIn: SESSION_TTL_SECONDS },
  );
  await redis.set(
    `user_token_${user._id}_${token}`,
    1,
    'EX',
    SESSION_TTL_SECONDS,
  );
  return token;
};
