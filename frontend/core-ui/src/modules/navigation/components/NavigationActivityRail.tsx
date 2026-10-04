import { NavigationActivityButton } from '@/navigation/components/navigation-activity-rail/NavigationActivityButton';
import { NavigationActivityGroups } from '@/navigation/components/navigation-activity-rail/NavigationActivityGroups';
import { NavigationActivitySearchButton } from '@/navigation/components/navigation-activity-rail/NavigationActivitySearchButton';
import { NavigationFavoritesSection } from '@/navigation/components/navigation-activity-rail/NavigationFavoritesSection';
import { NavigationInboxButton } from '@/navigation/components/navigation-activity-rail/NavigationInboxButton';
import { NavigationActivityMore } from '@/navigation/components/NavigationActivityMore';
import { NavigationRailLogo } from '@/navigation/components/NavigationRailLogo';
import { NavigationSidebarFooter } from '@/navigation/components/NavigationSidebarFooter';
import { INavigationActivity } from '@/navigation/types/NavigationActivity';
import {
  getPromotedNavigationRank,
  NAVIGATION_SEARCH_RANK,
  splitPromotedNavigationActivities,
} from '@/navigation/utils/promotedNavigationActivities';
import { cn, Sidebar } from 'erxes-ui';

export const NavigationActivityRail = ({
  activities,
  activeActivityId,
  hiddenActivities,
  isInboxActive,
  isActivityPinned,
  isSettings,
  mobileExpanded,
  onActivityPinnedChange,
  onSearch,
  onSelectInbox,
  onSelectActivity,
  visibleActivities,
}: Readonly<{
  activities: INavigationActivity[];
  activeActivityId: string | null;
  hiddenActivities: INavigationActivity[];
  isInboxActive: boolean;
  isActivityPinned: (activityId: string) => boolean;
  isSettings: boolean;
  mobileExpanded: boolean;
  onActivityPinnedChange: (activityId: string, pinned: boolean) => void;
  onSearch: () => void;
  onSelectInbox: () => void;
  onSelectActivity: (activity: INavigationActivity) => void;
  visibleActivities: INavigationActivity[];
}>) => {
  const { isMobile, state } = Sidebar.useSidebar();
  const expanded = isMobile ? mobileExpanded : state === 'expanded';
  const hoverEnabled = !expanded && !isMobile;
  const { promoted } = splitPromotedNavigationActivities(activities);
  const visibleRest = splitPromotedNavigationActivities(visibleActivities).rest;
  const hiddenRest = splitPromotedNavigationActivities(hiddenActivities).rest;
  const usePromotedRail = promoted.length > 0;
  const isAboveSearch = (activity: INavigationActivity) =>
    (getPromotedNavigationRank(activity) ?? 0) < NAVIGATION_SEARCH_RANK;
  const renderPromoted = (activity: INavigationActivity) => (
    <NavigationActivityButton
      key={activity.id}
      activity={activity}
      active={!isSettings && activity.id === activeActivityId}
      expanded={expanded}
      onSelect={() => onSelectActivity(activity)}
    />
  );

  return (
    <aside
      className={cn(
        'flex w-full shrink-0 flex-col border-none bg-rail px-2 py-2 text-rail-foreground',
        isMobile && !expanded && 'w-12',
      )}
    >
      <NavigationRailLogo expanded={expanded} />
      {usePromotedRail ? (
        <div className="mb-1 flex shrink-0 flex-col gap-1">
          <NavigationInboxButton
            expanded={expanded}
            isInboxActive={isInboxActive}
            onSelectInbox={onSelectInbox}
          />
          {promoted.filter(isAboveSearch).map(renderPromoted)}
          <NavigationActivitySearchButton
            expanded={expanded}
            onSearch={onSearch}
          />
          {promoted
            .filter((activity) => !isAboveSearch(activity))
            .map(renderPromoted)}
        </div>
      ) : (
        <NavigationActivitySearchButton
          expanded={expanded}
          onSearch={onSearch}
        />
      )}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col items-stretch gap-1 overflow-x-hidden overflow-y-auto',
          !expanded && 'hide-scroll',
        )}
      >
        <NavigationFavoritesSection
          expanded={expanded}
          isInboxActive={isInboxActive}
          onSelectInbox={onSelectInbox}
          showInbox={!usePromotedRail}
        />
        <NavigationActivityGroups
          activeActivityId={activeActivityId}
          activities={usePromotedRail ? visibleRest : visibleActivities}
          expanded={expanded}
          hoverEnabled={hoverEnabled}
          isActivityPinned={isActivityPinned}
          isSettings={isSettings}
          onActivityPinnedChange={onActivityPinnedChange}
          onSelectActivity={onSelectActivity}
        />
        <NavigationActivityMore
          activities={usePromotedRail ? hiddenRest : hiddenActivities}
          expanded={expanded}
          isActivityPinned={isActivityPinned}
          onPinnedChange={onActivityPinnedChange}
          onSelect={onSelectActivity}
        />
      </div>
      <NavigationSidebarFooter expanded={expanded} isSettings={isSettings} />
    </aside>
  );
};
