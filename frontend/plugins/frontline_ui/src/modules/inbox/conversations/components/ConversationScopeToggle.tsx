import { ToggleGroup, useMultiQueryState } from 'erxes-ui';
import { useAtomValue } from 'jotai';
import { currentUserState } from 'ui-modules';
import { useTranslation } from 'react-i18next';

type ConversationScopeQueries = {
  assignedTo: string;
  unassigned: boolean;
};

export const ConversationScopeToggle = () => {
  const { t } = useTranslation('frontline');
  const currentUser = useAtomValue(currentUserState);
  const [{ assignedTo }, setQueries] =
    useMultiQueryState<ConversationScopeQueries>(['assignedTo', 'unassigned']);

  const scope =
    currentUser?._id && assignedTo === currentUser._id ? 'me' : 'team';

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={scope}
      className="inline-flex shrink-0"
      onValueChange={(value: string) => {
        if (!value || value === scope) {
          return;
        }
        setQueries(
          value === 'me'
            ? { assignedTo: currentUser?._id || null, unassigned: null }
            : { assignedTo: null },
        );
      }}
    >
      <ToggleGroup.Item value="me" className="h-7 px-3 text-xs">
        {t('me', 'Me')}
      </ToggleGroup.Item>
      <ToggleGroup.Item value="team" className="h-7 px-3 text-xs">
        {t('team', 'Team')}
      </ToggleGroup.Item>
    </ToggleGroup>
  );
};
