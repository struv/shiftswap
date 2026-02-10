'use client';

import { TRPCProvider } from '@/components/TRPCProvider';
import { NotificationDropdown } from '@/components/NotificationDropdown';

export function NotificationBell() {
  return (
    <TRPCProvider>
      <NotificationDropdown />
    </TRPCProvider>
  );
}
