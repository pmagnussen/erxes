import { AppPath } from '@/types/paths/AppPath';
import { IconChevronLeft } from '@tabler/icons-react';
import { NavigationMenuLinkItem, Sidebar } from 'erxes-ui';
import { useAtomValue } from 'jotai';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePageTrackerStore } from 'react-page-tracker';
import { useNavigate } from 'react-router-dom';
import { pluginsConfigState, useVersion, usePermissionCheck } from 'ui-modules';
import { GET_CORE_MODULES } from '~/plugins/constants/core-plugins.constants';
import {
  CHANNEL_SETTINGS_PLUGINS,
  GET_SETTINGS_PATH_DATA,
  groupSettingsNav,
  SETTINGS_PERMISSION_MAP,
} from '../constants/data';
import { TSettingPath } from '@/types/paths/SettingsPath';

export function SettingsSidebar({
  hideExit = false,
}: Readonly<{ hideExit?: boolean }>) {
  const pluginsMetaData = useAtomValue(pluginsConfigState) || {};
  const { isLoaded, isWildcard, hasModulePermission, hasPluginPermission } =
    usePermissionCheck();

  const version = useVersion();
  const { t } = useTranslation('common', { keyPrefix: 'sidebar' });

  const CORE_MODULES = GET_CORE_MODULES(t, version);
  const sidebar = useMemo(() => GET_SETTINGS_PATH_DATA(version, t), [t]);

  const filterByPermission = (items: typeof sidebar.nav) => {
    if (!isLoaded || isWildcard) return items;
    return items.filter((item) => {
      const requiredModule = SETTINGS_PERMISSION_MAP[item.path];
      if (!requiredModule) return true;
      return hasModulePermission(requiredModule);
    });
  };

  const pluginsWithSettingsNavigations = Object.values(pluginsMetaData)
    .filter((plugin) => {
      if (!plugin.settingsNavigation) return false;
      if (!isLoaded || isWildcard) return true;
      return hasPluginPermission(plugin.name);
    })
    .map((plugin) => ({
      Navigation: plugin.settingsNavigation,
      name: plugin.name,
    }));

  const filteredNav = filterByPermission(sidebar.nav);
  const filteredDeveloper = filterByPermission(sidebar.developer);

  const filteredCoreModules = CORE_MODULES.filter((item) => {
    if (!item.hasSettings) return false;
    if (!isLoaded || isWildcard) return true;
    return hasModulePermission(item.path);
  });

  const grouped = groupSettingsNav(filteredNav);
  const channelPlugins = pluginsWithSettingsNavigations.filter(({ name }) =>
    CHANNEL_SETTINGS_PLUGINS.includes(name),
  );
  const otherPlugins = pluginsWithSettingsNavigations.filter(
    ({ name }) => !CHANNEL_SETTINGS_PLUGINS.includes(name),
  );

  const renderItems = (items: TSettingPath[]) =>
    items.map((item) => (
      <NavigationMenuLinkItem
        key={item.path}
        pathPrefix={AppPath.Settings}
        path={item.path}
        name={item.name}
        icon={item.icon}
      />
    ));

  return (
    <Sidebar.Content className="styled-scroll gap-1 [&_[data-active=true]]:rounded-full [&_[data-active=true]]:bg-primary/10 [&_[data-active=true]]:text-primary">
      {!hideExit && <SettingsExitButton />}
      <SettingsNavigationGroup name={t('settings-general', 'General')}>
        {renderItems([...sidebar.account, ...grouped.general])}
      </SettingsNavigationGroup>

      {channelPlugins.map(
        ({ Navigation, name }) => Navigation && <Navigation key={name} />,
      )}
      <SettingsNavigationGroup
        name={
          channelPlugins.length
            ? t('settings-channels-more', 'Channel settings')
            : t('settings-channels-routing', 'Channels & Routing')
        }
      >
        {renderItems(grouped.channels)}
      </SettingsNavigationGroup>

      <SettingsNavigationGroup name={t('settings-manage', 'Manage')}>
        {renderItems([...grouped.manage, ...grouped.other])}
      </SettingsNavigationGroup>

      <SettingsNavigationGroup name={t('core-modules')}>
        {filteredCoreModules.map((item) => (
          <NavigationMenuLinkItem
            key={item.name}
            pathPrefix={AppPath.Settings}
            path={item.path}
            name={item.name}
            icon={item.icon}
          />
        ))}
      </SettingsNavigationGroup>

      {otherPlugins.length > 0 && (
        <div className="flex flex-col gap-1">
          <SettingsGroupHeading
            name={t('settings-other-plugins', 'Other plugins')}
          />
          {otherPlugins.map(
            ({ Navigation, name }) => Navigation && <Navigation key={name} />,
          )}
        </div>
      )}

      <SettingsNavigationGroup name={t('developer')}>
        {renderItems(filteredDeveloper)}
      </SettingsNavigationGroup>

      <SettingsNavigationGroup name={t('settings-about', 'About')}>
        <li className="px-2 py-1 text-xs text-muted-foreground">
          {t('settings-version', 'Version')}:{' '}
          {version ? t('settings-os', 'erxes OS') : t('settings-saas', 'erxes')}
        </li>
      </SettingsNavigationGroup>
    </Sidebar.Content>
  );
}

function SettingsGroupHeading({ name }: Readonly<{ name: string }>) {
  return (
    <div className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
      {name}
    </div>
  );
}

export function SettingsNavigationGroup({
  name,
  children,
}: Readonly<{
  name: string;
  children: React.ReactNode;
}>) {
  if (React.Children.count(children) === 0) return null;

  return (
    <Sidebar.Group>
      <Sidebar.GroupLabel className="h-4 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
        {name}
      </Sidebar.GroupLabel>
      <Sidebar.GroupContent className="pt-1">
        <Sidebar.Menu>{children}</Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  );
}

export function SettingsExitButton() {
  const navigate = useNavigate();
  const pageHistory = usePageTrackerStore((state) => state.pageHistory);

  const handleExitSettings = () =>
    navigate(
      [...pageHistory].reverse().find((page) => !page.includes('settings')) ||
        '/',
    );

  const { t } = useTranslation('common', {
    keyPrefix: 'sidebar',
  });

  return (
    <Sidebar.Header className="p-4">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton onClick={handleExitSettings}>
            <IconChevronLeft />
            <span>{t('exit-settings')}</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </Sidebar.Header>
  );
}
