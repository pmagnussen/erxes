import { IconSearch } from '@tabler/icons-react';
import {
  Avatar,
  Badge,
  Empty,
  Input,
  Select,
  Spinner,
  cn,
} from 'erxes-ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BUCKET_ICONS, BUCKET_ORDER } from '@/team-board/components/BucketIcon';
import { useQueueBoard, useTeamBoard } from '@/team-board/hooks/useTeamBoard';
import { ITeamBoardAgent, TBoardStatus } from '@/team-board/types/teamBoard';

const ALL = 'all';

const STATUS_ORDER: TBoardStatus[] = ['working', 'away', 'offline'];

const STATUS_DOT: Record<TBoardStatus, string> = {
  working: 'bg-green-500',
  away: 'bg-orange-400',
  offline: 'bg-gray-400',
};

const useStatusLabels = (): Record<TBoardStatus, string> => {
  const { t } = useTranslation('frontline');
  return {
    working: t('status-working', 'Working'),
    away: t('status-away', 'Away'),
    offline: t('status-offline', 'Offline'),
  };
};

const AgentRow = ({ agent }: { agent: ITeamBoardAgent }) => {
  const navigate = useNavigate();
  const labels = useStatusLabels();
  const name = agent.fullName || agent.email || agent._id;

  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/60 border-b last:border-b-0"
      onClick={() => navigate(`/frontline/inbox?assignedTo=${agent._id}`)}
    >
      <span className="relative shrink-0">
        <Avatar size="xl">
          <Avatar.Image src={agent.avatar} />
          <Avatar.Fallback>{name.charAt(0).toUpperCase()}</Avatar.Fallback>
        </Avatar>
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background',
            STATUS_DOT[agent.boardStatus],
          )}
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {labels[agent.boardStatus]}
        </span>
      </span>
      <span className="flex items-center gap-4">
        {BUCKET_ORDER.map((bucket) => {
          const Icon = BUCKET_ICONS[bucket];
          const value = agent.counts?.[bucket] ?? 0;
          return (
            <span
              key={bucket}
              title={bucket}
              className={cn(
                'flex w-10 items-center gap-1 text-sm tabular-nums',
                value ? 'text-foreground' : 'text-muted-foreground/50',
              )}
            >
              <Icon className="size-4" />
              {value}
            </span>
          );
        })}
        <Badge variant="secondary" className="w-10 justify-center">
          {agent.counts?.total ?? 0}
        </Badge>
      </span>
    </button>
  );
};

export const TeamBoard = () => {
  const { t } = useTranslation('frontline');
  const labels = useStatusLabels();
  const [status, setStatus] = useState<string>(ALL);
  const [channelId, setChannelId] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const { agents, loading, error } = useTeamBoard(
    channelId === ALL ? undefined : channelId,
  );
  const { queues } = useQueueBoard();

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = agents.filter(
      (agent) =>
        (status === ALL || agent.boardStatus === status) &&
        (!term ||
          `${agent.fullName ?? ''} ${agent.email ?? ''}`
            .toLowerCase()
            .includes(term)),
    );
    return STATUS_ORDER.map((key) => ({
      key,
      agents: filtered
        .filter((agent) => agent.boardStatus === key)
        .sort((a, b) => (b.counts?.total ?? 0) - (a.counts?.total ?? 0)),
    })).filter((group) => group.agents.length);
  }, [agents, status, search]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Select value={status} onValueChange={(v) => v && setStatus(v)}>
          <Select.Trigger className="h-8 w-40">
            <Select.Value placeholder={t('status', 'Status')} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL}>{t('all-statuses', 'All statuses')}</Select.Item>
            {STATUS_ORDER.map((key) => (
              <Select.Item key={key} value={key}>
                {labels[key]}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <Select value={channelId} onValueChange={(v) => v && setChannelId(v)}>
          <Select.Trigger className="h-8 w-48">
            <Select.Value placeholder={t('channel', 'Channel')} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value={ALL}>{t('all-channels', 'All channels')}</Select.Item>
            {queues.map((queue) => (
              <Select.Item key={queue._id} value={queue._id}>
                {queue.name || queue._id}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-8"
            value={search}
            placeholder={t('search-agent', 'Search agent')}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && !agents.length ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : error ? (
          <Empty>
            <Empty.Header>
              <Empty.Title>{t('team-board-error', 'Could not load team')}</Empty.Title>
              <Empty.Description>{error.message}</Empty.Description>
            </Empty.Header>
          </Empty>
        ) : !groups.length ? (
          <Empty>
            <Empty.Header>
              <Empty.Title>{t('no-agents', 'No agents found')}</Empty.Title>
            </Empty.Header>
          </Empty>
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <h3 className="sticky top-0 z-10 flex items-center gap-2 bg-background px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
                <span className={cn('size-2 rounded-full', STATUS_DOT[group.key])} />
                {labels[group.key]} ({group.agents.length})
              </h3>
              {group.agents.map((agent) => (
                <AgentRow key={agent._id} agent={agent} />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
};
