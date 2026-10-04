import { PipelineStage } from 'mongoose';
import { CONVERSATION_STATUSES } from '@/inbox/db/definitions/constants';

export type ChannelBucket = 'email' | 'chat' | 'messenger' | 'call' | 'other';

export const CHANNEL_BUCKETS: ChannelBucket[] = [
  'call',
  'email',
  'chat',
  'messenger',
  'other',
];

export const OPEN_CONVERSATION_STATUSES = [
  CONVERSATION_STATUSES.NEW,
  CONVERSATION_STATUSES.OPEN,
];

/**
 * Maps an integration kind to the Dixa-style channel bucket shown on the team
 * board. Unknown kinds fall into `other`.
 */
export const kindToBucket = (kind?: string | null): ChannelBucket => {
  const value = (kind || '').toLowerCase();

  if (!value) return 'other';
  if (
    value === 'mail' ||
    value === 'imap' ||
    value.startsWith('gmail') ||
    value.includes('email') ||
    value.includes('outlook')
  ) {
    return 'email';
  }
  if (value === 'messenger') return 'chat';
  if (
    value.startsWith('facebook') ||
    value.startsWith('instagram') ||
    value.includes('messenger') ||
    value.includes('whatsapp')
  ) {
    return 'messenger';
  }
  if (
    value === 'calls' ||
    value === 'call' ||
    value.startsWith('callpro') ||
    value.includes('telnyx') ||
    value.includes('voip')
  ) {
    return 'call';
  }

  return 'other';
};

export type IBucketCounts = Record<ChannelBucket, number> & { total: number };

export const emptyBucketCounts = (): IBucketCounts => ({
  call: 0,
  email: 0,
  chat: 0,
  messenger: 0,
  other: 0,
  total: 0,
});

/**
 * Open conversations in the given integrations, grouped by assignee and
 * integration. Integration kind is resolved in memory from the integrations
 * already loaded for scoping, so no cross-collection `$lookup` is needed.
 */
export const buildAssigneeIntegrationPipeline = (
  integrationIds: string[],
): PipelineStage[] => [
  {
    $match: {
      integrationId: { $in: integrationIds },
      status: { $in: OPEN_CONVERSATION_STATUSES },
      assignedUserId: { $exists: true, $nin: [null, ''] },
    },
  },
  {
    $group: {
      _id: { userId: '$assignedUserId', integrationId: '$integrationId' },
      count: { $sum: 1 },
    },
  },
];

/**
 * Open conversations per integration split by assigned/unassigned, plus the
 * oldest unassigned createdAt.
 */
export const buildQueueIntegrationPipeline = (
  integrationIds: string[],
): PipelineStage[] => [
  {
    $match: {
      integrationId: { $in: integrationIds },
      status: { $in: OPEN_CONVERSATION_STATUSES },
    },
  },
  {
    $project: {
      integrationId: 1,
      createdAt: 1,
      isAssigned: {
        $cond: [
          {
            $and: [
              { $ifNull: ['$assignedUserId', false] },
              { $ne: ['$assignedUserId', ''] },
            ],
          },
          1,
          0,
        ],
      },
    },
  },
  {
    $group: {
      _id: '$integrationId',
      assigned: { $sum: '$isAssigned' },
      unassigned: { $sum: { $subtract: [1, '$isAssigned'] } },
      oldestUnassigned: {
        $min: {
          $cond: [{ $eq: ['$isAssigned', 0] }, '$createdAt', null],
        },
      },
    },
  },
];

export interface IAssigneeIntegrationRow {
  _id: { userId: string; integrationId: string };
  count: number;
}

export const reduceAssigneeCounts = (
  rows: IAssigneeIntegrationRow[],
  kindByIntegration: Map<string, string>,
): Map<string, IBucketCounts> => {
  const result = new Map<string, IBucketCounts>();

  for (const row of rows) {
    const userId = String(row._id.userId);
    const bucket = kindToBucket(
      kindByIntegration.get(String(row._id.integrationId)),
    );
    const counts = result.get(userId) ?? emptyBucketCounts();

    counts[bucket] += row.count;
    counts.total += row.count;
    result.set(userId, counts);
  }

  return result;
};

/** Normalises core `chatStatus` (`online`/`offline`/unset) to board status. */
export const toBoardStatus = (
  chatStatus?: string | null,
): 'working' | 'away' | 'offline' => {
  if (chatStatus === 'online' || chatStatus === 'working') return 'working';
  if (chatStatus === 'away') return 'away';
  return 'offline';
};
