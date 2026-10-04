import { IconLock, IconMessage2 } from '@tabler/icons-react';
import { Tabs } from 'erxes-ui';
import { useTranslation } from 'react-i18next';

type ComposerModeTabsProps = {
  isInternalNote: boolean;
  disabled: boolean;
  replyDisabled?: boolean;
  onInternalNoteChange: (internal: boolean) => void;
};

export const ComposerModeTabs = ({
  isInternalNote,
  disabled,
  replyDisabled = false,
  onInternalNoteChange,
}: ComposerModeTabsProps) => {
  const { t } = useTranslation('frontline');

  return (
    <Tabs
      value={isInternalNote ? 'internal' : 'reply'}
      onValueChange={(value) => onInternalNoteChange(value === 'internal')}
      className="min-w-0 flex-1"
    >
      <Tabs.List
        className="h-8 w-auto gap-4 bg-transparent p-0"
      >
        <Tabs.Trigger
          value="reply"
          disabled={disabled || replyDisabled}
          className="h-8 gap-1.5 rounded-none border-b-2 border-transparent px-1 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
        >
          <IconMessage2 className="size-3.5" />
          {t('answer', 'Answer')}
        </Tabs.Trigger>
        <Tabs.Trigger
          value="internal"
          disabled={disabled}
          className="h-8 gap-1.5 rounded-none border-b-2 border-transparent px-1 text-xs shadow-none data-[state=active]:border-warning data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
        >
          <IconLock className="size-3.5" />
          {t('internal-note-tab', 'Internal note')}
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
};
