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
    refetchInterval: 30_000, // Poll every 30 seconds
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

  // Close dropdown when clicking outside
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

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'swap_request': return 'New';
      case 'swap_approved': return 'OK';
      case 'swap_denied': return 'No';
      default: return '';
    }
  }

  function getTypeBadgeColor(type: string): string {
    switch (type) {
      case 'swap_request': return 'bg-blue-100 text-blue-700';
      case 'swap_approved': return 'bg-green-100 text-green-700';
      case 'swap_denied': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800"
                disabled={markAllReadMutation.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No notifications yet
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification.id, notification.link)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors ${
                    !notification.read_at ? 'bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${getTypeBadgeColor(
                        notification.type
                      )} mt-0.5 shrink-0`}
                    >
                      {getTypeIcon(notification.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {notification.title}
                        </span>
                        {!notification.read_at && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <span className="text-xs text-gray-400 mt-1 block">
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
