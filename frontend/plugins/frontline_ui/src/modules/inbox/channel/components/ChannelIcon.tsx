import { IconInbox, type TablerIcon } from '@tabler/icons-react';
import { IconComponent } from 'erxes-ui';
import type { ComponentPropsWithoutRef } from 'react';

type ChannelIconProps = ComponentPropsWithoutRef<TablerIcon> & {
  name?: string | null;
};

// Channels created without an icon would otherwise render the `Icon123` fallback.
export const ChannelIcon = ({ name, ...props }: ChannelIconProps) => {
  if (!name) {
    return <IconInbox {...props} />;
  }
  return <IconComponent name={name} {...props} />;
};
