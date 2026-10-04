import { Empty, RelativeDateDisplay, Spinner, Table, cn } from 'erxes-ui';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BUCKET_ICONS } from '@/team-board/components/BucketIcon';
import { useQueueBoard } from '@/team-board/hooks/useTeamBoard';

export const QueueBoard = () => {
  const { t } = useTranslation('frontline');
  const navigate = useNavigate();
  const { queues, loading, error } = useQueueBoard();

  if (loading && !queues.length) {
    return (
      <div className="flex justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error || !queues.length) {
    return (
      <Empty>
        <Empty.Header>
          <Empty.Title>
            {error
              ? t('queue-board-error', 'Could not load queues')
              : t('no-queues', 'No queues found')}
          </Empty.Title>
          {error && <Empty.Description>{error.message}</Empty.Description>}
        </Empty.Header>
      </Empty>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>{t('queue', 'Queue')}</Table.Head>
            <Table.Head className="text-right">
              {t('unassigned', 'Unassigned')}
            </Table.Head>
            <Table.Head className="text-right">
              {t('assigned', 'Assigned')}
            </Table.Head>
            <Table.Head>{t('longest-waiting', 'Longest waiting')}</Table.Head>
            <Table.Head className="text-right">
              {t('agents-online', 'Agents online')}
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {queues.map((queue) => (
            <Table.Row
              key={queue._id}
              className="cursor-pointer"
              onClick={() =>
                navigate(
                  `/frontline/inbox?channelId=${queue._id}&unassigned=true`,
                )
              }
            >
              <Table.Cell>
                <span className="flex items-center gap-2 font-medium">
                  {queue.name || queue._id}
                  <span className="flex gap-1 text-muted-foreground">
                    {queue.buckets.map((bucket) => {
                      const Icon = BUCKET_ICONS[bucket] ?? BUCKET_ICONS.other;
                      return <Icon key={bucket} className="size-3.5" />;
                    })}
                  </span>
                </span>
              </Table.Cell>
              <Table.Cell
                className={cn(
                  'text-right tabular-nums',
                  queue.unassignedCount
                    ? 'font-semibold text-orange-600'
                    : 'text-muted-foreground',
                )}
              >
                {queue.unassignedCount}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {queue.assignedCount}
              </Table.Cell>
              <Table.Cell>
                {queue.oldestUnassignedAt ? (
                  <RelativeDateDisplay.Value value={queue.oldestUnassignedAt} />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </Table.Cell>
              <Table.Cell className="text-right tabular-nums">
                {queue.onlineCount} / {queue.memberCount}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
};
