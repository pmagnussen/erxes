export type TChannelBucket = 'call' | 'email' | 'chat' | 'messenger' | 'other';

export type TBoardStatus = 'working' | 'away' | 'offline';

export type ITeamBoardCounts = Record<TChannelBucket, number> & {
  total: number;
};

export interface ITeamBoardAgent {
  _id: string;
  email?: string;
  username?: string;
  fullName?: string;
  avatar?: string;
  chatStatus?: string;
  boardStatus: TBoardStatus;
  counts: ITeamBoardCounts;
}

export interface IQueueBoardRow {
  _id: string;
  name?: string;
  buckets: TChannelBucket[];
  assignedCount: number;
  unassignedCount: number;
  oldestUnassignedAt?: string | null;
  memberCount: number;
  onlineCount: number;
}
