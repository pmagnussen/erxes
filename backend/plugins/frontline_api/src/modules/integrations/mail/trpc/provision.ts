import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { FrontlineTRPCContext } from '~/init-trpc';
import { ChannelScopes } from '@/channel/@types/channel';
import {
  IInboxBody,
  ensureChannel,
  ownerId,
  snapshotMail,
  upsertMailInbox,
  upsertPipelineMailbox,
} from '@/integrations/mail/controller/provision';

const t = initTRPC.context<FrontlineTRPCContext>().create();

const server = z
  .object({
    host: z.string(),
    port: z.number().optional(),
    secure: z.boolean().optional(),
    user: z.string(),
    password: z.string().optional(),
    mailbox: z.string().optional(),
    sentMailbox: z.string().optional(),
  })
  .optional();

const mailbox = z.object({
  address: z.string(),
  senderName: z.string().optional(),
  imap: server,
  smtp: server,
});

/**
 * Internal building blocks for the vera provisioning plugin, which owns the
 * public init API and its auth. Every call is idempotent by name/address.
 */
export const mailProvisionTrpcRouter = t.router({
  mailProvision: t.router({
    snapshot: t.procedure.query(async ({ ctx }) => {
      const { models } = ctx;
      const channels = await models.Channels.find({
        scope: { $ne: ChannelScopes.PERSONAL },
      }).lean();
      const pipelines = await models.Pipeline.find({}).lean();

      return {
        channels: channels.map((c) => ({ _id: c._id, name: c.name })),
        pipelines: pipelines.map((p) => ({
          _id: p._id,
          name: p.name,
          channelId: p.channelId,
        })),
        mail: await snapshotMail(models),
      };
    }),

    ensureChannel: t.procedure
      .input(z.object({ name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const userId = await ownerId(ctx.subdomain);
        const channel = await ensureChannel(ctx.models, userId, {
          channelName: input.name,
        });

        return { _id: channel._id, name: channel.name };
      }),

    ensurePipeline: t.procedure
      .input(z.object({ channelId: z.string(), name: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const { models, subdomain } = ctx;
        const existing = await models.Pipeline.findOne({
          channelId: input.channelId,
          name: input.name,
        }).lean();

        const pipeline =
          existing ??
          (await models.Pipeline.addPipeline({
            channelId: input.channelId,
            name: input.name,
            userId: await ownerId(subdomain),
          }));

        const statuses = await models.Status.find({
          pipelineId: pipeline._id,
        })
          .sort({ type: 1, order: 1 })
          .lean();

        return {
          _id: pipeline._id,
          name: pipeline.name,
          statuses: statuses.map((s) => ({ _id: s._id, name: s.name })),
        };
      }),

    upsertInbox: t.procedure
      .input(
        mailbox.extend({
          channelId: z.string(),
          name: z.string().optional(),
          brandId: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        upsertMailInbox(ctx.models, ctx.subdomain, input as IInboxBody),
      ),

    upsertPipelineMail: t.procedure
      .input(mailbox.extend({ pipelineId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { pipelineId, ...body } = input;

        return upsertPipelineMailbox(
          ctx.models,
          ctx.subdomain,
          pipelineId,
          body as IInboxBody,
        );
      }),
  }),
});
