import { PageContainer } from 'erxes-ui';
import { useLocation } from 'react-router-dom';
import { QueueBoard } from '@/team-board/components/QueueBoard';
import { TeamBoard } from '@/team-board/components/TeamBoard';
import { TeamBoardHeader } from '@/team-board/components/TeamBoardHeader';

export const TeamBoardPage = () => {
  const location = useLocation();

  return (
    <PageContainer>
      <TeamBoardHeader />
      {location.pathname.includes('/queues') ? <QueueBoard /> : <TeamBoard />}
    </PageContainer>
  );
};
