import {
  IconBrandMessenger,
  IconDots,
  IconMail,
  IconMessage,
  IconPhone,
  type TablerIcon,
} from '@tabler/icons-react';
import { TChannelBucket } from '@/team-board/types/teamBoard';

export const BUCKET_ICONS: Record<TChannelBucket, TablerIcon> = {
  call: IconPhone,
  email: IconMail,
  chat: IconMessage,
  messenger: IconBrandMessenger,
  other: IconDots,
};

export const BUCKET_ORDER: TChannelBucket[] = [
  'call',
  'email',
  'chat',
  'messenger',
  'other',
];
