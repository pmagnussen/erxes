import { ThemeSelector } from '@/navigation/components/ThemeSelector';
import { User } from '@/navigation/components/User';
import { NavigationRailLabel } from '@/navigation/components/NavigationRailLabel';
import { AppPath } from '@/types/paths/AppPath';
import { SettingsPath } from '@/types/paths/SettingsPath';
import { IconChevronRight, IconSettings } from '@tabler/icons-react';
import { Avatar, Button, cn, DropdownMenu, readImage } from 'erxes-ui';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { currentUserState } from 'ui-modules';

export const NavigationSidebarFooter = ({
  expanded,
  isSettings,
}: {
  expanded: boolean;
  isSettings: boolean;
}) => {
  const currentUser = useAtomValue(currentUserState);
  const { t: organizationT } = useTranslation('organization');
  const { t: sidebarT } = useTranslation('common', { keyPrefix: 'sidebar' });
  const userDetails = currentUser?.details;
  const userName = userDetails?.fullName || sidebarT('profile');

  return (
    <div className="flex flex-col items-stretch gap-1 pb-2">
      <Button
        asChild
        className={cn(
          'h-7 shrink-0 justify-start gap-2 rounded text-sm text-rail-foreground hover:bg-white/10 hover:text-rail-foreground transition-[width,margin,padding] duration-200 ease-linear [&>svg]:size-4!',
          expanded ? 'w-full px-2' : 'ml-0.5 w-7 px-1.5',
          isSettings && 'bg-rail-active hover:bg-rail-active',
        )}
        size="default"
        variant="ghost"
      >
        <Link
          aria-label={organizationT('settings')}
          to={`/${AppPath.Settings}`}
        >
          <IconSettings
            className={cn(
              'size-4 text-rail-foreground/80',
              isSettings && 'text-rail-foreground',
            )}
          />
          <NavigationRailLabel
            className="truncate font-medium"
            expanded={expanded}
          >
            {organizationT('settings')}
          </NavigationRailLabel>
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            aria-label={sidebarT('profile')}
            className={cn(
              'h-10 shrink-0 justify-start gap-2 rounded text-sm text-rail-foreground hover:bg-white/10 hover:text-rail-foreground transition-[width,margin,padding] duration-200 ease-linear',
              expanded ? 'w-full px-1' : 'ml-0.5 w-7 gap-0 px-0.5',
            )}
            size="default"
            variant="ghost"
          >
            <Avatar className="size-6">
              <Avatar.Image
                src={readImage(userDetails?.avatar || '')}
                alt={userName}
              />
              <Avatar.Fallback className="text-[10px]">
                {userName.charAt(0)}
              </Avatar.Fallback>
            </Avatar>
            <NavigationRailLabel
              className="grid flex-1 text-left leading-tight"
              expanded={expanded}
            >
              <span className="truncate font-medium">{userName}</span>
              <span className="truncate text-[11px] text-rail-muted">
                {currentUser?.email}
              </span>
            </NavigationRailLabel>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          align={expanded ? 'start' : 'end'}
          className="w-48 min-w-48! space-y-1 p-1.5"
          side={expanded ? 'top' : 'right'}
          sideOffset={8}
        >
          <DropdownMenu.Item asChild className="p-2">
            <Link to={`/${AppPath.Settings}/${SettingsPath.Profile}`}>
              <User />
              <IconChevronRight className="text-muted-foreground" />
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          {/* vera.fo: language and logout are owned by the vera portal */}
          <ThemeSelector />
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};
