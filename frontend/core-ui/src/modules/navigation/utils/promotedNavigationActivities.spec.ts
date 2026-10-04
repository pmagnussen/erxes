import { INavigationActivity } from '@/navigation/types/NavigationActivity';
import {
  getPromotedNavigationRank,
  isPromotedNavigationActivity,
  NAVIGATION_SEARCH_RANK,
  splitPromotedNavigationActivities,
} from '@/navigation/utils/promotedNavigationActivities';

const activity = (
  defaultPath: string,
  id = defaultPath,
): INavigationActivity => ({
  id,
  label: id,
  kind: 'plugin',
  modules: [],
  defaultPath,
});

describe('promoted navigation activities', () => {
  it('ranks Conversations, Contacts, Command, then AI Agent', () => {
    expect(getPromotedNavigationRank(activity('frontline/inbox'))).toBe(0);
    expect(getPromotedNavigationRank(activity('contacts'))).toBe(1);
    expect(getPromotedNavigationRank(activity('cf-os'))).toBe(2);
    expect(getPromotedNavigationRank(activity('erxes-agent'))).toBe(3);
    expect(getPromotedNavigationRank(activity('/cf-os/'))).toBe(2);
    expect(NAVIGATION_SEARCH_RANK).toBe(2);
  });

  it('leaves other plugins unpromoted', () => {
    expect(isPromotedNavigationActivity(activity('sales'))).toBe(false);
    expect(isPromotedNavigationActivity(activity('erxes-agent/agents'))).toBe(
      false,
    );
  });

  it('pulls Command and AI Agent out of the plugin list and sorts them', () => {
    const sales = activity('sales');
    const agent = activity('erxes-agent', 'AI Agent');
    const command = activity('cf-os', 'command');
    const operation = activity('operation');

    expect(
      splitPromotedNavigationActivities([sales, agent, command, operation]),
    ).toEqual({
      promoted: [command, agent],
      rest: [sales, operation],
    });
  });

  it('puts Conversations and Contacts first in Dixa order', () => {
    const contacts = activity('contacts', 'core:contacts');
    const frontline = activity('frontline/inbox', 'frontline');
    const command = activity('cf-os', 'command');
    const sales = activity('sales');

    expect(
      splitPromotedNavigationActivities([command, contacts, sales, frontline]),
    ).toEqual({
      promoted: [frontline, contacts, command],
      rest: [sales],
    });
  });

  it('keeps the full plugin list when neither product is loaded', () => {
    const sales = activity('sales');
    const operation = activity('operation');

    expect(splitPromotedNavigationActivities([sales, operation])).toEqual({
      promoted: [],
      rest: [sales, operation],
    });
  });
});
