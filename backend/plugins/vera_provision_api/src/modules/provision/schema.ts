import { z } from 'zod';

const server = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().min(1),
  password: z.string().optional(),
  mailbox: z.string().optional(),
  sentMailbox: z.string().optional(),
});

const mailbox = z.object({
  address: z.string().email(),
  senderName: z.string().optional(),
  imap: server,
  smtp: server,
});

export const initSchema = z.object({
  company: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }),
  channels: z.array(z.string().min(1)).min(1).default(['Support']),
  mail: z
    .object({
      channel: z.string().default('Support'),
      inboxName: z.string().optional(),
    })
    .merge(mailbox)
    .optional(),
  tickets: z
    .object({
      channel: z.string().default('Support'),
      pipelineName: z.string().default('Support'),
      mail: mailbox.optional(),
    })
    .optional(),
  facebook: z.object({ channel: z.string().default('Support') }).optional(),
});

export type TInitInput = z.infer<typeof initSchema>;
