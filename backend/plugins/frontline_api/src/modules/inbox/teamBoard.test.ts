import {
  buildAssigneeIntegrationPipeline,
  buildQueueIntegrationPipeline,
  kindToBucket,
  reduceAssigneeCounts,
  toBoardStatus,
} from '@/inbox/teamBoard';

describe('kindToBucket', () => {
  it.each([
    ['mail', 'email'],
    ['imap', 'email'],
    ['gmail', 'email'],
    ['messenger', 'chat'],
    ['facebook-messenger', 'messenger'],
    ['instagram-messenger', 'messenger'],
    ['calls', 'call'],
    ['callpro', 'call'],
    ['lead', 'other'],
    [undefined, 'other'],
  ])('%s -> %s', (kind, bucket) => {
    expect(kindToBucket(kind)).toBe(bucket);
  });
});

describe('pipelines', () => {
  it('assignee pipeline matches only open, assigned, scoped conversations', () => {
    const [match, group] = buildAssigneeIntegrationPipeline(['i1']);
    expect(match).toEqual({
      $match: {
        integrationId: { $in: ['i1'] },
        status: { $in: ['new', 'open'] },
        assignedUserId: { $exists: true, $nin: [null, ''] },
      },
    });
    expect(group).toHaveProperty('$group._id', {
      userId: '$assignedUserId',
      integrationId: '$integrationId',
    });
  });

  it('queue pipeline groups by integration', () => {
    const stages = buildQueueIntegrationPipeline(['i1']);
    expect(stages).toHaveLength(3);
    expect(stages[2]).toHaveProperty('$group._id', '$integrationId');
  });
});

describe('reduceAssigneeCounts', () => {
  it('sums rows per user into buckets', () => {
    const kinds = new Map([
      ['a', 'mail'],
      ['b', 'messenger'],
    ]);
    const result = reduceAssigneeCounts(
      [
        { _id: { userId: 'u1', integrationId: 'a' }, count: 2 },
        { _id: { userId: 'u1', integrationId: 'b' }, count: 3 },
        { _id: { userId: 'u2', integrationId: 'x' }, count: 1 },
      ],
      kinds,
    );
    expect(result.get('u1')).toMatchObject({ email: 2, chat: 3, total: 5 });
    expect(result.get('u2')).toMatchObject({ other: 1, total: 1 });
  });
});

describe('toBoardStatus', () => {
  it('maps core chatStatus', () => {
    expect(toBoardStatus('online')).toBe('working');
    expect(toBoardStatus('away')).toBe('away');
    expect(toBoardStatus(undefined)).toBe('offline');
  });
});
