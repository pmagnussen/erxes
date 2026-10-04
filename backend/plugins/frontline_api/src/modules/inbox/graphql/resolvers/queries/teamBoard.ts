import {
  buildAssigneeIntegrationPipeline,
  buildQueueIntegrationPipeline,
  emptyBucketCounts,
  IAssigneeIntegrationRow,
  IBucketCounts,
  kindToBucket,
  reduceAssigneeCounts,
  toBoardStatus,
} from '@/inbox/teamBoard';
import { visibleChannelsFilter } from '@/channel/utils';
import { markResolvers, sendTRPCMessage } from 'erxes-api-shared/utils';
import { IContext, IModels } from '~/connectionResolvers';
import QueryBuilder from '~/conversationQueryBuilder';

interface IBoardUser {
  _id: string;
  email?: string;
  username?: string;
  chatStatus?: string;
  isActive?: boolean;
  details?: { fullName?: string; avatar?: string; shortName?: string };
}

interface IQueueRow {
  _id: string;
  assigned: number;
  unassigned: number;
  oldestUnassigned?: Date | null;
}

/**
 * Integration ids the caller may see, scoped exactly like the conversations
 * list (system role: all; others: their channel memberships, active only).
 */
const scopedIntegrations = async (
  models: IModels,
  subdomain: string,
  user: IContext['user'],
  channelId?: string,
) => {
  const qb = new QueryBuilder(
    models,
    subdomain,
    { channelId },
    {
      _id: user._id,
      code: user.code,
      starredConversationIds: user.starredConversationIds,
      role: user.role,
    },
  );

  await qb.defaultFilters();
  const { integrationId } = await qb.integrationsFilter();
  const ids: string[] = (integrationId.$in || []).map(String);

  const integrations = await models.Integrations.find(
    { _id: { $in: ids } },
    { _id: 1, kind: 1, channelId: 1 },
  ).lean();

  return integrations.map((i) => ({
    _id: String(i._id),
    kind: i.kind,
    channelId: i.channelId ? String(i.channelId) : '',
  }));
};

const fetchUsers = async (
  subdomain: string,
  userIds: string[],
): Promise<IBoardUser[]> => {
  if (!userIds.length) return [];

  return sendTRPCMessage({
    subdomain,
    pluginName: 'core',
    method: 'query',
    module: 'users',
    action: 'find',
    input: { query: { _id: { $in: userIds }, isActive: { $ne: false } } },
    defaultValue: [],
  });
};

export const teamBoardQueries = {
  /**
   * Dixa-style team overview: every agent of the visible channels with chat
   * status and open conversation counts per channel bucket.
   */
  async frontlineTeamBoard(
    _root: undefined,
    { channelId }: { channelId?: string },
    { user, models, subdomain }: IContext,
  ) {
    if (!user?._id) throw new Error('Unauthorized');

    const integrations = await scopedIntegrations(
      models,
      subdomain,
      user,
      channelId,
    );
    const kindByIntegration = new Map(
      integrations.map((i) => [i._id, i.kind]),
    );
    const channelIds = [
      ...new Set(integrations.map((i) => i.channelId).filter(Boolean)),
    ];

    const rows = await models.Conversations.aggregate<IAssigneeIntegrationRow>(
      buildAssigneeIntegrationPipeline(integrations.map((i) => i._id)),
    );
    const countsByUser = reduceAssigneeCounts(rows, kindByIntegration);

    const memberIds: string[] = channelIds.length
      ? await models.ChannelMembers.find({
          channelId: { $in: channelIds },
        }).distinct('memberId')
      : [];

    const userIds = [
      ...new Set([...memberIds.map(String), ...countsByUser.keys()]),
    ];
    const users = await fetchUsers(subdomain, userIds);

    return users.map((u) => {
      const counts: IBucketCounts =
        countsByUser.get(String(u._id)) ?? emptyBucketCounts();

      return {
        _id: String(u._id),
        email: u.email,
        username: u.username,
        fullName: u.details?.fullName || u.username || u.email || '',
        avatar: u.details?.avatar,
        chatStatus: u.chatStatus || 'offline',
        boardStatus: toBoardStatus(u.chatStatus),
        counts,
      };
    });
  },

  /**
   * Real-time queue dashboard: one row per visible channel (queue).
   */
  async frontlineQueueBoard(
    _root: undefined,
    _args: Record<string, never>,
    { user, models, subdomain }: IContext,
  ) {
    if (!user?._id) throw new Error('Unauthorized');

    const integrations = await scopedIntegrations(models, subdomain, user);
    const channelFilter = await visibleChannelsFilter({
      models,
      subdomain,
      user,
    });
    const channels = await models.Channels.find(channelFilter, {
      _id: 1,
      name: 1,
    })
      .sort({ name: 1 })
      .lean();

    const rows = await models.Conversations.aggregate<IQueueRow>(
      buildQueueIntegrationPipeline(integrations.map((i) => i._id)),
    );
    const integrationById = new Map(integrations.map((i) => [i._id, i]));

    const channelIds = channels.map((c) => String(c._id));
    const memberships = await models.ChannelMembers.find(
      { channelId: { $in: channelIds } },
      { channelId: 1, memberId: 1 },
    ).lean();
    const users = await fetchUsers(subdomain, [
      ...new Set(memberships.map((m) => String(m.memberId))),
    ]);
    const onlineIds = new Set(
      users
        .filter((u) => toBoardStatus(u.chatStatus) === 'working')
        .map((u) => String(u._id)),
    );

    return channels.map((channel) => {
      const id = String(channel._id);
      let assigned = 0;
      let unassigned = 0;
      let oldest: Date | null = null;
      const buckets = new Set<string>();

      for (const integ of integrations) {
        if (integ.channelId === id) buckets.add(kindToBucket(integ.kind));
      }

      for (const row of rows) {
        if (integrationById.get(String(row._id))?.channelId !== id) continue;
        assigned += row.assigned;
        unassigned += row.unassigned;
        if (row.oldestUnassigned && (!oldest || row.oldestUnassigned < oldest))
          oldest = row.oldestUnassigned;
      }

      const members = memberships.filter((m) => String(m.channelId) === id);

      return {
        _id: id,
        name: channel.name,
        buckets: [...buckets],
        assignedCount: assigned,
        unassignedCount: unassigned,
        oldestUnassignedAt: oldest,
        memberCount: members.length,
        onlineCount: members.filter((m) => onlineIds.has(String(m.memberId)))
          .length,
      };
    });
  },
};

markResolvers(teamBoardQueries, {
  wrapperConfig: {
    skipPermission: true,
  },
});
