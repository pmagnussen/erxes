import { useQuery } from '@apollo/client';
import {
  IconChevronDown,
  IconCopy,
  IconMail,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';
import {
  Avatar,
  Badge,
  Button,
  Collapsible,
  RelativeDateDisplay,
  Skeleton,
  toast,
  useQueryState,
} from 'erxes-ui';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomerDetail } from 'ui-modules';
import { GET_CONVERSATIONS } from '@/inbox/conversations/graphql/queries/getConversations';
import { ConversationStatus, type IConversation } from '@/inbox/types/Conversation';
import { ConversationProperties } from './ConversationProperties';

const PanelSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Collapsible defaultOpen className="border-b border-border/60">
    <Collapsible.Trigger asChild>
      <Button
        variant="ghost"
        className="group h-9 w-full justify-between rounded-none px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {title}
        <IconChevronDown className="size-4 transition-transform group-data-[state=closed]:-rotate-90" />
      </Button>
    </Collapsible.Trigger>
    <Collapsible.Content className="px-4 pb-3">{children}</Collapsible.Content>
  </Collapsible>
);

const CopyRow = ({ icon, value }: { icon: ReactNode; value?: string }) => {
  const { t } = useTranslation('frontline');
  if (!value) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(
      () => toast({ title: t('copied', 'Copied') }),
      (error: Error) =>
        toast({
          title: t('error', 'Error'),
          description: error.message,
          variant: 'destructive',
        }),
    );
  };
  return (
    <div className="group flex min-w-0 items-center gap-2 text-sm">
      <span className="flex-none text-muted-foreground">{icon}</span>
      <span className="truncate">{value}</span>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto size-6 flex-none opacity-0 group-hover:opacity-100"
        aria-label={t('copy', 'Copy')}
        onClick={handleCopy}
      >
        <IconCopy className="size-3.5" />
      </Button>
    </div>
  );
};

const ContactCard = ({ customerId }: { customerId: string }) => {
  const { t } = useTranslation('frontline');
  const { customerDetail, loading } = useCustomerDetail({
    variables: { _id: customerId },
    skip: !customerId,
  });

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }
  if (!customerDetail) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('anonymous-customer', 'Anonymous customer')}
      </div>
    );
  }
  const name =
    [customerDetail.firstName, customerDetail.lastName]
      .filter(Boolean)
      .join(' ') ||
    customerDetail.primaryEmail ||
    customerDetail.primaryPhone ||
    t('anonymous-customer', 'Anonymous customer');

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Avatar size="xl">
          <Avatar.Image src={customerDetail.avatar} />
          <Avatar.Fallback>{name.charAt(0).toUpperCase()}</Avatar.Fallback>
        </Avatar>
        <span className="truncate font-semibold">{name}</span>
      </div>
      <CopyRow
        icon={<IconMail className="size-4" />}
        value={customerDetail.primaryEmail}
      />
      <CopyRow
        icon={<IconPhone className="size-4" />}
        value={customerDetail.primaryPhone}
      />
    </div>
  );
};

const ConversationHistory = ({
  customerId,
  currentId,
}: {
  customerId: string;
  currentId: string;
}) => {
  const { t } = useTranslation('frontline');
  const [, setConversationId] = useQueryState<string>('conversationId');
  const { data, loading } = useQuery<{
    conversations: { list: IConversation[] };
  }>(GET_CONVERSATIONS, {
    variables: { customerId, limit: 10 },
    skip: !customerId,
    fetchPolicy: 'cache-and-network',
  });
  const list = (data?.conversations?.list || []).filter(
    (conversation) => conversation._id !== currentId,
  );

  if (loading && !data) {
    return <Skeleton className="h-10 w-full" />;
  }
  if (!list.length) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('no-other-conversations', 'No other conversations')}
      </div>
    );
  }
  return (
    <div className="-mx-2 flex flex-col">
      {list.map((conversation) => (
        <Button
          key={conversation._id}
          variant="ghost"
          className="h-auto justify-start gap-2 px-2 py-1.5 text-left font-normal"
          onClick={() => setConversationId(conversation._id)}
        >
          <span className="flex-none text-xs text-muted-foreground tabular-nums">
            #{conversation._id.slice(-6)}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs">
            {conversation.createdAt && (
              <RelativeDateDisplay.Value
                value={conversation.updatedAt || conversation.createdAt}
                isShort
              />
            )}
          </span>
          <Badge
            variant={
              conversation.status === ConversationStatus.CLOSED
                ? 'secondary'
                : 'success'
            }
            className="flex-none text-xs"
          >
            {conversation.status === ConversationStatus.CLOSED
              ? t('resolved', 'Resolved')
              : t('open', 'Open')}
          </Badge>
        </Button>
      ))}
    </div>
  );
};

export const ConversationCustomerPanel = ({
  customerId,
  _id,
  propertiesData,
}: {
  customerId: string;
  _id: string;
  propertiesData?: Record<string, unknown>;
}) => {
  const { t } = useTranslation(['frontline', 'common']);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="flex h-11 flex-none items-center gap-2 border-b border-border/60 px-4 text-sm font-semibold">
        <IconUser className="size-4" />
        {t('customer-info', 'Customer info')}
      </div>
      <PanelSection title={t('contact', 'Contact')}>
        <ContactCard customerId={customerId} />
      </PanelSection>
      <PanelSection title={t('conversation-details', 'Conversation details')}>
        <ConversationProperties id={_id} propertiesData={propertiesData} />
      </PanelSection>
      <PanelSection title={t('conversation-history', 'Conversation history')}>
        <ConversationHistory customerId={customerId} currentId={_id} />
      </PanelSection>
    </div>
  );
};
