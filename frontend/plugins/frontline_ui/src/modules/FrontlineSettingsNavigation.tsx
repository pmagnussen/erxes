import {
  IconGauge,
  IconInbox,
  IconPlugConnected,
  IconUserCircle,
} from '@tabler/icons-react';
import { FrontlinePaths } from '@/types/FrontlinePaths';
import { SettingsNavigationMenuLinkItem, Sidebar } from 'erxes-ui';
import { Can } from 'ui-modules';
import { useTranslation } from 'react-i18next';

/**
 * Rendered by core-ui inside the Dixa-style "Channels & Routing" group, so
 * frontline items lead that group: Queues (channels) first.
 */
export const FrontlineSettingsNavigation = () => {
  const { t } = useTranslation('frontline');
  return (
    <Sidebar.Group>
      <Sidebar.GroupLabel className="h-4 text-[10px] font-semibold uppercase tracking-wider">
        {t('channels-and-routing', 'Channels & Routing')}
      </Sidebar.GroupLabel>
      <Sidebar.GroupContent className="pt-1">
        <Sidebar.Menu>
          <SettingsNavigationMenuLinkItem
            pathPrefix={FrontlinePaths.Frontline}
            path={FrontlinePaths.Channels}
            name={t('queues', 'Queues')}
            icon={IconInbox}
          />
          <SettingsNavigationMenuLinkItem
            pathPrefix={FrontlinePaths.Frontline}
            path={FrontlinePaths.WorkloadLimits}
            name={t('workload-limits', 'Workload limits')}
            icon={IconGauge}
          />
          <SettingsNavigationMenuLinkItem
            pathPrefix={FrontlinePaths.Frontline}
            path={FrontlinePaths.PersonalChannel}
            name={t('personal-channel', 'Personal channel')}
            icon={IconUserCircle}
          />
          <Can action="integrationsEdit">
            <SettingsNavigationMenuLinkItem
              pathPrefix={FrontlinePaths.Frontline}
              path={FrontlinePaths.IntegrationConfig}
              name={t('integrations-config', 'Integrations config')}
              icon={IconPlugConnected}
            />
          </Can>
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  );
};
