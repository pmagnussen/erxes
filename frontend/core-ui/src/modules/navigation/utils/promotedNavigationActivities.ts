import { INavigationActivity } from '@/navigation/types/NavigationActivity';

/**
 * Dixa-style rail order, matched on activity defaultPath:
 * Conversations, Contacts, (Search), Command, AI Agent.
 * Activities ranked below NAVIGATION_SEARCH_RANK render above the Search button.
 */
const PROMOTED_NAVIGATION_RANK: Record<string, number> = {
  'frontline/inbox': 0,
  contacts: 1,
  'cf-os': 2,
  'erxes-agent': 3,
};

export const NAVIGATION_SEARCH_RANK = 2;

const trimPath = (path: string) => path.replace(/^\/+|\/+$/g, '');

export const getPromotedNavigationRank = (activity: INavigationActivity) => {
  const rank = PROMOTED_NAVIGATION_RANK[trimPath(activity.defaultPath)];

  return rank === undefined ? null : rank;
};

export const isPromotedNavigationActivity = (activity: INavigationActivity) =>
  getPromotedNavigationRank(activity) !== null;

export const splitPromotedNavigationActivities = (
  activities: INavigationActivity[],
) => {
  const promoted: INavigationActivity[] = [];
  const rest: INavigationActivity[] = [];

  for (const activity of activities) {
    if (isPromotedNavigationActivity(activity)) {
      promoted.push(activity);
    } else {
      rest.push(activity);
    }
  }

  promoted.sort(
    (left, right) =>
      (getPromotedNavigationRank(left) ?? 0) -
      (getPromotedNavigationRank(right) ?? 0),
  );

  return { promoted, rest };
};
