import { useQuery } from '@apollo/client';
import {
  FRONTLINE_QUEUE_BOARD,
  FRONTLINE_TEAM_BOARD,
} from '@/team-board/graphql/teamBoardQueries';
import { IQueueBoardRow, ITeamBoardAgent } from '@/team-board/types/teamBoard';

export const TEAM_BOARD_POLL_INTERVAL = 15000;

export const useTeamBoard = (
  channelId?: string,
): { agents: ITeamBoardAgent[]; loading: boolean; error?: Error } => {
  const { data, loading, error } = useQuery<{
    frontlineTeamBoard: ITeamBoardAgent[];
  }>(FRONTLINE_TEAM_BOARD, {
    variables: { channelId: channelId || undefined },
    pollInterval: TEAM_BOARD_POLL_INTERVAL,
    fetchPolicy: 'cache-and-network',
  });

  return { agents: data?.frontlineTeamBoard ?? [], loading, error };
};

export const useQueueBoard = (): {
  queues: IQueueBoardRow[];
  loading: boolean;
  error?: Error;
} => {
  const { data, loading, error } = useQuery<{
    frontlineQueueBoard: IQueueBoardRow[];
  }>(FRONTLINE_QUEUE_BOARD, {
    pollInterval: TEAM_BOARD_POLL_INTERVAL,
    fetchPolicy: 'cache-and-network',
  });

  return { queues: data?.frontlineQueueBoard ?? [], loading, error };
};
