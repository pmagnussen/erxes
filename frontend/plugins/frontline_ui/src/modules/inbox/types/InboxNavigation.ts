export type TInboxNavigationFilters = {
  assignedTo: string;
  awaitingResponse: boolean;
  brandId: string;
  channelId: string;
  conversationId: string;
  integrationId: string;
  integrationType: string;
  mentioned: boolean;
  participating: boolean;
  searchValue: string;
  unassigned: boolean;
};

export type TInboxNavigationFilterValues = {
  [Key in keyof TInboxNavigationFilters]: TInboxNavigationFilters[Key] | null;
};

export const INBOX_NAVIGATION_FILTER_KEYS: Array<
  keyof TInboxNavigationFilters
> = [
  'participating',
  'mentioned',
  'unassigned',
  'assignedTo',
  'awaitingResponse',
  'channelId',
  'integrationId',
  'integrationType',
  'brandId',
  'conversationId',
  'searchValue',
];

export const CLEARED_INBOX_NAVIGATION_FILTERS: TInboxNavigationFilterValues = {
  assignedTo: null,
  awaitingResponse: null,
  brandId: null,
  channelId: null,
  conversationId: null,
  integrationId: null,
  integrationType: null,
  mentioned: null,
  participating: null,
  searchValue: null,
  unassigned: null,
};
