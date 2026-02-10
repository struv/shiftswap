'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: countData } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const { data: listData } = trpc.notification.list.useQuery(
    { limit: 10 },
    { enabled: isOpen }
  );

  const invalidateNotifications = () => {
    utils.notification.list.invalidate();
    utils.notification.unreadCount.invalidate();
  };

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: invalidateNotifications,
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: invalidateNotifications,
  });

  const unreadCount = countData?.count ?? 0;
  const notifications = listData?.notifications ?? [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleNotificationClick(notificationId: string, link: string | null) {
    if (!notifications.find((n) => n.id === notificationId)?.read_at) {
      markReadMutation.mutate({ id: notificationId });
    }
    setIsOpen(false);
    if (link) {
      router.push(link);
    }
  }

  function handleMarkAllRead() {
    markAllReadMutation.mutate();
  }

  function getTimeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  function getTypeIcon(type: string): React.ReactNode {
    switch (type) {
      case 'swap_request':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3l5 5-5 5" />
            <path d="M21 8H9" />
            <path d="M8 21l-5-5 5-5" />
            <path d="M3 16h12" />
          </svg>
        );
      case 'swap_approved':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'swap_denied':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      default:
        return null;
    }
  }

  function getTypeBadgeColor(type: string): string {
    switch (type) {
      case 'swap_request': return 'bg-brand-100 text-brand-700';
      case 'swap_approved': return 'bg-emerald-100 text-emerald-700';
      case 'swap_denied': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-xl bg-surface-secondary border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-border transition-all"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-[18px] h-[18px]"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold leading-none text-white bg-rose-500 rounded-full shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface rounded-2xl shadow-xl border border-border z-50 animate-fade-in-down overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
            <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                disabled={markAllReadMutation.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                    <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id, notification.link)}
                  className={`w-full text-left px-5 py-3.5 hover:bg-surface-secondary border-b border-border-light transition-colors last:border-0 ${
                    !notification.read_at ? 'bg-brand-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-medium shrink-0 mt-0.5 ${getTypeBadgeColor(
                        notification.type
                      )}`}
                    >
                      {getTypeIcon(notification.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {notification.title}
                        </span>
                        {!notification.read_at && (
                          <span className="w-2 h-2 bg-brand-500 rounded-full shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <span className="text-[11px] text-text-tertiary mt-1 block">
                        {getTimeAgo(notification.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
