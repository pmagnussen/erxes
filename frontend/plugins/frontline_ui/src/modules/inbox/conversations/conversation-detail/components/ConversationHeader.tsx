import { useAssignConversations } from '@/inbox/conversations/hooks/useAssignConversations';
import { useConversationAutomatedReplyControl } from '@/inbox/conversations/hooks/useConversationAutomatedReplyControl';
import { useConversationContext } from '@/inbox/conversations/hooks/useConversationContext';
import { useDiscordConversationChannel } from '@/integrations/discord/hooks/useDiscordSetup';
import { IntegrationType } from '@/types/Integration';
import { useChangeConversationStatus } from '@/inbox/conversations/hooks/useChangeConversationStatus';
import { useConversationListVisibility } from '@/inbox/hooks/useConversationListVisibility';
import { useInboxLayout } from '@/inbox/hooks/useInboxLayout';
import { useOverflowCompact } from '@/inbox/hooks/useCompactWidth';
import { refetchConversationsAtom } from '@/inbox/conversations/states/refetchConversationState';
import { ConversationStatus } from '@/inbox/types/Conversation';
import { IntegrationActions } from '@/integrations/components/IntegrationActions';
import {
  IconArrowLeft,
  IconCircleCheck,
  IconCircleDashed,
  IconDots,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlayerPause,
  IconPlayerPlay,
  IconTags,
  IconUser,
} from '@tabler/icons-react';
import {
  Avatar,
  Button,
  Combobox,
  DropdownMenu,
  PopoverScoped,
  Skeleton,
  Tooltip,
  cn,
  toast,
  useQueryState,
} from 'erxes-ui';
import { useAtomValue } from 'jotai';
import { CustomersInline, SelectMember, TagsSelect } from 'ui-modules';
import { ConversationActions } from '@/inbox/conversations/conversation-detail/components/ConversationActions';
import { ConversationConvert } from '@/inbox/conversations/conversation-detail/components/convert/ConversationConvert';
import { useTranslation } from 'react-i18next';
import { ChannelIcon } from '@/inbox/channel/components/ChannelIcon';
import { Badge } from 'erxes-ui';
import { type SyntheticEvent, useState } from 'react';

const stopEventPropagation = (event: SyntheticEvent) => {
  event.stopPropagation();
};

const ConversationListToggle = () => {
  const { t } = useTranslation('frontline');
  const { isHidden, toggle } = useConversationListVisibility();
  const Icon = isHidden
    ? IconLayoutSidebarLeftExpand
    : IconLayoutSidebarLeftCollapse;
  const label = t(isHidden ? 'show-conversations' : 'hide-conversations');

  return (
    <Tooltip.Provider>
      <Tooltip delayDuration={0}>
        <Tooltip.Trigger asChild>
          <Button
            aria-label={label}
            variant="secondary"
            size="icon"
            className="[&>svg]:size-4 text-foreground flex-none"
            onClick={toggle}
          >
            <Icon />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>{label}</Tooltip.Content>
      </Tooltip>
    </Tooltip.Provider>
  );
};

const ConversationHeaderProfile = () => {
  const { _id, integration, customer, customerId } = useConversationContext();
  const isDiscord = integration?.kind === IntegrationType.DISCORD_MESSENGER;
  const { channel, loading } = useDiscordConversationChannel(
    _id,
    !_id || !isDiscord,
  );

  if (isDiscord && loading && !channel?.channelName) {
    return (
      <div className="flex items-center gap-2 flex-none">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="w-32 h-4" />
      </div>
    );
  }

  if (isDiscord && channel?.channelName) {
    const letter = channel.channelName.trim().charAt(0).toUpperCase();
    return (
      <div className="flex items-center gap-2 flex-none">
        <Avatar size="lg">
          <Avatar.Fallback className="bg-primary/10 text-primary font-medium">
            {letter}
          </Avatar.Fallback>
        </Avatar>
        <span
          className="text-sm text-foreground"
          title={`Discord channel: #${channel.channelName}`}
        >
          #{channel.channelName}
        </span>
      </div>
    );
  }

  return (
    <CustomersInline
      customers={customer ? [customer] : undefined}
      customerIds={customerId ? [customerId] : undefined}
      className="text-sm font-semibold text-foreground flex-none"
      placeholder="anonymous customer"
    />
  );
};

const AutomatedReplyStatusBadge = () => {
  const { _id, automatedReplyControl } = useConversationContext();
  const { setAutomatedReplyControl, loading } =
    useConversationAutomatedReplyControl();
  const status = automatedReplyControl?.status;

  if (!status) {
    return null;
  }

  const isActive = status === 'active';
  const label = isActive
    ? 'Automation active'
    : status === 'human_active' &&
      automatedReplyControl?.reason === 'operator_reply'
    ? 'Automation paused: operator active'
    : 'Automation paused';
  const nextStatus = isActive ? 'human_active' : 'active';
  const actionLabel = isActive ? 'Pause automation' : 'Resume automation';
  const Icon = isActive ? IconPlayerPlay : IconPlayerPause;
  const ActionIcon = isActive ? IconPlayerPause : IconPlayerPlay;

  const handleToggleAutomation = () => {
    setAutomatedReplyControl({
      variables: {
        _id,
        status: nextStatus,
        reason: 'manual',
      },
      onCompleted: () => {
        toast({
          title: isActive ? 'Automation paused' : 'Automation resumed',
        });
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-7 flex-none gap-1.5 rounded-md border px-2 text-xs font-medium shadow-none',
            isActive
              ? 'border-border bg-muted/50 text-muted-foreground hover:bg-muted'
              : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15',
          )}
          disabled={loading}
        >
          <Icon className="size-3.5 flex-none" />
          <span className="max-w-[280px] truncate">{label}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="min-w-[220px]">
        <DropdownMenu.Item disabled={loading} onClick={handleToggleAutomation}>
          <ActionIcon className="size-4" />
          {actionLabel}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

const AssignConversation = ({
  withinDropdown = false,
}: {
  withinDropdown?: boolean;
}) => {
  const { t } = useTranslation('frontline');
  const { assignedUserId, _id } = useConversationContext();
  const { assignConversations } = useAssignConversations();
  const [open, setOpen] = useState(false);

  const handleAssignConversations = (value: null | string | string[]) => {
    const result = Array.isArray(value) ? value[value.length - 1] : value;

    assignConversations({
      variables: {
        conversationIds: [_id],
        assignedUserId: result,
      },
      onError: (error: Error) => {
        toast({
          title: t('error', 'Error'),
          description: error.message,
          variant: 'destructive',
        });
      },
      refetchQueries: ['ConversationDetail', 'Conversations'],
    });
  };

  return (
    <div className="flex">
      <SelectMember.Provider
        mode="single"
        value={assignedUserId}
        onValueChange={(value) => {
          handleAssignConversations(value);
          setOpen(false);
        }}
      >
        <PopoverScoped open={open} onOpenChange={setOpen}>
          <Combobox.Trigger
            className="text-foreground shadow-none px-2"
            variant="outline"
            onPointerDown={withinDropdown ? stopEventPropagation : undefined}
            onClick={withinDropdown ? stopEventPropagation : undefined}
            onKeyDown={withinDropdown ? stopEventPropagation : undefined}
          >
            <SelectMember.Value size="lg" />
          </Combobox.Trigger>
          <Combobox.Content>
            <SelectMember.Content />
          </Combobox.Content>
        </PopoverScoped>
      </SelectMember.Provider>
    </div>
  );
};

export const ConversationTags = ({
  showAllTags = false,
  withinDropdown = false,
}: {
  showAllTags?: boolean;
  withinDropdown?: boolean;
}) => {
  const { t } = useTranslation('frontline');
  const { _id, tagIds, setTagIds } = useConversationContext();
  if (!_id) return null;

  return (
    <div className="min-w-0 flex-none">
      <TagsSelect.Provider
        type="frontline:conversation"
        mode="multiple"
        value={tagIds}
        targetIds={[_id]}
        onValueChange={setTagIds}
        options={() => ({
          onCompleted: () => {
            toast({
              title: t('tag-updated', 'Tag updated'),
              variant: 'default',
            });
          },
          onError: (error: Error) => {
            toast({
              title: t('failed-to-update-tags', 'Failed to update tags'),
              description: error.message,
              variant: 'destructive',
            });
          },
        })}
      >
        <div
          className={cn(
            'flex items-center gap-2',
            showAllTags && 'flex-col items-stretch',
          )}
        >
          {showAllTags && (
            <div className="flex max-h-28 w-full flex-wrap gap-2 overflow-y-auto pr-1">
              <TagsSelect.SelectedList />
            </div>
          )}
          <TagsSelect.Trigger
            showValue={!showAllTags}
            placeholder={
              showAllTags ? t('add-tags', 'Add tags') : t('tags', 'Tags')
            }
            variant="outline"
            size="sm"
            className={cn(
              'shrink-0',
              showAllTags &&
                'order-last w-full justify-between border-dashed bg-muted/30',
            )}
            onPointerDown={withinDropdown ? stopEventPropagation : undefined}
            onClick={withinDropdown ? stopEventPropagation : undefined}
            onKeyDown={withinDropdown ? stopEventPropagation : undefined}
          />
        </div>
        <Combobox.Content align="end" className="w-64 min-w-0 p-0">
          <TagsSelect.Content />
        </Combobox.Content>
      </TagsSelect.Provider>
    </div>
  );
};

const ConversationActionsDropdown = ({
  showAssignee = false,
}: {
  showAssignee?: boolean;
}) => {
  const { t } = useTranslation('frontline');
  const { _id, status } = useConversationContext();
  const { changeConversationStatus, loading } = useChangeConversationStatus();
  const refetchConversations = useAtomValue(refetchConversationsAtom);
  const isClosed = status === ConversationStatus.CLOSED;
  const StatusIcon = isClosed ? IconCircleDashed : IconCircleCheck;

  const handleStatusChange = () => {
    changeConversationStatus({
      variables: {
        ids: [_id],
        status:
          status === ConversationStatus.CLOSED
            ? ConversationStatus.OPEN
            : ConversationStatus.CLOSED,
      },
    });
    if (refetchConversations) {
      refetchConversations();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="secondary"
          size="icon"
          className="flex-none [&>svg]:size-4"
          aria-label={t('actions', 'Actions')}
        >
          <IconDots />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        align="end"
        className="w-80 max-w-[calc(100vw-1rem)] p-1.5"
      >
        {showAssignee && (
          <>
            <DropdownMenu.Label className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
              <IconUser className="size-4" />
              {t('assignee', 'Assignee')}
            </DropdownMenu.Label>
            <div className="px-1 pb-2">
              <AssignConversation withinDropdown />
            </div>
            <DropdownMenu.Separator />
          </>
        )}
        <DropdownMenu.Label className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
          <IconTags className="size-4" />
          {t('tags', 'Tags')}
        </DropdownMenu.Label>
        <div className="px-1 pb-2">
          <ConversationTags showAllTags withinDropdown />
        </div>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          className="mt-1 gap-2"
          onSelect={handleStatusChange}
          disabled={loading}
        >
          <StatusIcon className="size-4" />
          {isClosed ? t('open-label', 'Open') : t('resolve', 'Resolve')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};

const ConversationQueueChip = () => {
  const { integration } = useConversationContext();
  const channel = integration?.channel;
  if (!channel?.name) return null;
  return (
    <span
      className="flex h-6 max-w-40 flex-none items-center gap-1 rounded bg-primary/10 px-2 text-xs font-medium text-primary"
      title={channel.name}
    >
      <ChannelIcon name={channel.icon} className="size-3 flex-none" />
      <span className="truncate">{channel.name}</span>
    </span>
  );
};

const ConversationStatusBadge = () => {
  const { t } = useTranslation('frontline');
  const { status } = useConversationContext();
  const isClosed = status === ConversationStatus.CLOSED;
  return (
    <Badge
      variant={isClosed ? 'secondary' : 'success'}
      className="flex-none text-xs"
    >
      {isClosed ? t('resolved', 'Resolved') : t('open', 'Open')}
    </Badge>
  );
};

export const ConversationHeader = () => {
  const { loading, _id, status, integration } = useConversationContext();
  const [, setConversationId] = useQueryState<string>('conversationId');
  const view = useInboxLayout();
  const {
    ref: headerRef,
    isCompact,
    compactLevel,
  } = useOverflowCompact<HTMLDivElement>();
  const hideAssignee = compactLevel === 2;
  const isClosed = status === ConversationStatus.CLOSED;

  return (
    <div
      className={cn(
        'flex flex-none flex-col border-l-4',
        isClosed ? 'border-l-muted-foreground/40' : 'border-l-success',
      )}
    >
      <div
        ref={headerRef}
        className="h-12 flex items-center px-4 text-xs font-medium text-accent-foreground flex-none gap-3 whitespace-nowrap overflow-hidden"
      >
        {view === 'list' ? (
          <Button
            variant="secondary"
            size="icon"
            className="[&>svg]:size-4 text-foreground flex-none"
            onClick={() => setConversationId(null)}
          >
            <IconArrowLeft />
          </Button>
        ) : (
          <ConversationListToggle />
        )}
        {integration?.channel && (
          <ChannelIcon
            name={integration.channel.icon}
            className="size-4 flex-none text-muted-foreground"
          />
        )}
        {!loading ? (
          <ConversationHeaderProfile />
        ) : (
          <Skeleton className="w-32 h-4 ml-2" />
        )}
        {_id && (
          <span className="flex-none text-xs text-muted-foreground tabular-nums">
            #{_id.slice(-6)}
          </span>
        )}
        <AutomatedReplyStatusBadge />
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {!hideAssignee && <AssignConversation />}
          {!isCompact && <ConversationQueueChip />}
          <ConversationStatusBadge />
        </div>
      </div>
      <div className="flex h-10 items-center gap-2 overflow-hidden whitespace-nowrap border-t border-border/60 px-4">
        {!isCompact && <ConversationTags />}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <IntegrationActions />
          <ConversationConvert />
          {isCompact ? (
            <ConversationActionsDropdown showAssignee={hideAssignee} />
          ) : (
            <ConversationActions />
          )}
        </div>
      </div>
    </div>
  );
};
