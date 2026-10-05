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

const stage = z.object({
  name: z.string().min(1),
  probability: z.enum([
    '10%',
    '20%',
    '30%',
    '40%',
    '50%',
    '60%',
    '70%',
    '80%',
    '90%',
    'Won',
    'Lost',
  ]),
});

export const salesSchema = z.object({
  mainCurrency: z.string().length(3).default('DKK'),
  currencies: z.array(z.string().length(3)).min(1).default(['DKK', 'EUR']),
  uoms: z
    .array(z.object({ name: z.string().min(1), code: z.string().min(1) }))
    .default([
      { name: 'Stk.', code: 'stk' },
      { name: 'Tími', code: 'tim' },
      { name: 'Mánaður', code: 'man' },
    ]),
  productCategories: z
    .array(z.object({ name: z.string().min(1), code: z.string().min(1) }))
    .default([
      { name: 'Vørur', code: 'vorur' },
      { name: 'Tænastur', code: 'taenastur' },
      { name: 'Haldsavtalur', code: 'hald' },
    ]),
  board: z.string().min(1).default('Søla'),
  pipelines: z
    .array(
      z.object({
        name: z.string().min(1),
        stages: z.array(stage).min(1),
        labels: z
          .array(z.object({ name: z.string().min(1), colorCode: z.string() }))
          .default([]),
      }),
    )
    .default([
      {
        name: 'Sølurás',
        stages: [
          { name: 'Nýggj ábending', probability: '10%' },
          { name: 'Samband fingið', probability: '20%' },
          { name: 'Tørvur kannaður', probability: '40%' },
          { name: 'Tilboð sent', probability: '60%' },
          { name: 'Samráðingar', probability: '80%' },
          { name: 'Vunnið', probability: 'Won' },
          { name: 'Tapt', probability: 'Lost' },
        ],
        labels: [
          { name: 'Heitt', colorCode: '#ef4444' },
          { name: 'Nýggjur kundi', colorCode: '#3b82f6' },
          { name: 'Eldri kundi', colorCode: '#22c55e' },
          { name: 'Stórt tilboð', colorCode: '#a855f7' },
        ],
      },
    ]),
});

export type TSalesInput = z.infer<typeof salesSchema>;

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
  /** {} = defaults (DKK, Søla board, Sølurás pipeline...). */
  sales: salesSchema.optional(),
});

export type TInitInput = z.infer<typeof initSchema>;
