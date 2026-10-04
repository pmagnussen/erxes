import { TChannelBucket } from '@/team-board/types/teamBoard';

export type IWorkloadLimits = Partial<Record<TChannelBucket, number | null>>;
