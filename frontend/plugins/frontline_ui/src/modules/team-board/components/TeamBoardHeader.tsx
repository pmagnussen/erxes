import { IconUsersGroup } from '@tabler/icons-react';
import { Breadcrumb, Button, Separator, ToggleGroup } from 'erxes-ui';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from 'ui-modules';

const ROUTES = {
  team: '/frontline/team',
  queues: '/frontline/queues',
} as const;

type TSection = keyof typeof ROUTES;

export const TeamBoardHeader = () => {
  const { t } = useTranslation('frontline');
  const location = useLocation();
  const navigate = useNavigate();
  const active: TSection = location.pathname.includes('/queues')
    ? 'queues'
    : 'team';

  return (
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={ROUTES.team}>
                  <IconUsersGroup />
                  {t('team-overview', 'Team overview')}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <ToggleGroup
          type="single"
          value={active}
          onValueChange={(value) => {
            if (value === 'team' || value === 'queues') navigate(ROUTES[value]);
          }}
        >
          <ToggleGroup.Item value="team">
            {t('team-board-agents', 'Agents')}
          </ToggleGroup.Item>
          <ToggleGroup.Item value="queues">
            {t('queue-dashboard', 'Queue dashboard')}
          </ToggleGroup.Item>
        </ToggleGroup>
      </PageHeader.Start>
    </PageHeader>
  );
};
