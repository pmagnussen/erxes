import { NavigationActivityPinButton } from '@/navigation/components/NavigationActivityPinButton';
import { NavigationRailLabel } from '@/navigation/components/NavigationRailLabel';
import { INavigationActivity } from '@/navigation/types/NavigationActivity';
import { IconApps } from '@tabler/icons-react';
import { Button, cn } from 'erxes-ui';
import type { ReactNode } from 'react';

export const NavigationActivityButton = ({
  activity,
  active,
  expanded,
  indicator,
  pinned,
  onPinnedChange,
  onSelect,
}: Readonly<{
  activity: INavigationActivity;
  active: boolean;
  expanded: boolean;
  indicator?: ReactNode;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onSelect: () => void;
}>) => {
  const Icon = activity.icon || IconApps;

  return (
    <div className="group/activity relative flex h-7 w-full min-w-0 shrink-0">
      <Button
        aria-label={activity.label}
        className={cn(
          'relative h-7 min-w-0 shrink-0 justify-start gap-2 rounded text-sm text-rail-foreground hover:bg-white/10 hover:text-rail-foreground transition-[width,margin,padding] duration-200 ease-linear [&>svg]:size-4!',
          expanded ? 'w-full px-2' : 'ml-0.5 w-7 px-1.5',
          expanded && onPinnedChange && 'pr-8',
          active && 'bg-rail-active hover:bg-rail-active',
        )}
        onClick={onSelect}
        size="default"
        variant="ghost"
      >
        <Icon
          className={cn(
            'size-4 text-rail-foreground/80',
            active && 'text-rail-foreground',
          )}
        />
        <NavigationRailLabel
          className="truncate text-left font-medium"
          expanded={expanded}
        >
          {activity.label}
        </NavigationRailLabel>
        {expanded && indicator && (
          <span className="ml-auto flex shrink-0 items-center [&_[data-slot=badge]]:bg-white [&_[data-slot=badge]]:text-rail-background [&>*]:bg-white [&>*]:font-semibold [&>*]:text-rail-background">
            {indicator}
          </span>
        )}
      </Button>
      {expanded && onPinnedChange && pinned !== undefined && (
        <NavigationActivityPinButton
          activity={activity}
          className="absolute top-0 right-0 text-rail-muted opacity-0 hover:bg-white/10 hover:text-rail-foreground group-focus-within/activity:opacity-100 group-hover/activity:opacity-100"
          pinned={pinned}
          onPinnedChange={onPinnedChange}
        />
      )}
    </div>
  );
};
