import { cn } from 'erxes-ui';

import { InboxImage } from '@/inbox/conversation-messages/components/InboxImage';

export const ReactionLabel = ({ label }: { label: string }) => {
  const customEmoji = /^<(a?):[^:]+:(\d+)>$/.exec(label);
  if (!customEmoji) return label;
  const [, animated, id] = customEmoji;
  return (
    <InboxImage
      src={`https://cdn.discordapp.com/emojis/${id}.${
        animated ? 'gif' : 'png'
      }`}
      alt="Custom emoji"
      className="inline-block size-4 object-contain"
    />
  );
};

export const DiscordEditedStatus = ({ edited }: { edited?: boolean }) => {
  if (!edited) {
    return null;
  }

  return <span className="text-muted-foreground/70">(edited)</span>;
};

export const getMessageBubbleClassName = ({
  userId,
  internal,
  fromBot,
  isBotMessage,
  separatePrevious,
  showAuthorName,
  showBotName,
  hasReply,
}: {
  userId?: string;
  internal?: boolean;
  fromBot?: boolean;
  isBotMessage?: boolean;
  separatePrevious: boolean;
  showAuthorName: boolean;
  showBotName: boolean;
  hasReply?: boolean;
}) =>
  cn(
    'mt-1.5 block h-auto min-h-0 rounded-2xl border border-transparent px-3.5 py-2.5 text-left font-normal shadow-[0_1px_2px_rgba(15,23,42,0.06)] **:whitespace-pre-wrap space-y-1.5 overflow-x-hidden text-pretty wrap-break-word [&_a]:text-primary [&_a]:underline [&_img]:aspect-square [&_img]:object-cover [&_img]:rounded-xl',
    userId && 'rounded-br-md border-border/60 bg-muted hover:bg-muted',
    !userId &&
      'rounded-bl-md border-border/60 bg-background hover:bg-background',
    isBotMessage && 'border-border/60 bg-muted hover:bg-muted',
    internal &&
      'border-note bg-note hover:bg-note before:mb-1 before:block before:text-[11px] before:font-semibold before:uppercase before:tracking-wide before:text-foreground/60 before:content-["Internal_note"]',
    fromBot && 'bg-primary/5 hover:bg-primary/5 border-l-2 border-primary',
    separatePrevious &&
      !hasReply &&
      (showAuthorName || showBotName ? 'mt-0' : 'mt-6'),
    hasReply && 'mt-0 rounded-t-md',
  );
