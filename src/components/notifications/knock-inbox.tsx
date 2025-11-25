"use client";

import { useEffect, useRef, useState } from "react";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationFeedPopover,
  NotificationIconButton,
  FilterStatus,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";

type KnockInboxProps = {
  userId: string;
};

const publicApiKey = process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY;
const feedId = process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;

export function KnockInbox({ userId }: KnockInboxProps) {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  if (!publicApiKey || !feedId) {
    return null;
  }

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <KnockProvider
      apiKey={publicApiKey}
      user={{ id: userId }}
      i18n={{
        locale: "en",
        translations: {
          notifications: "Notifications",
        },
      }}
    >
      <KnockFeedProvider feedId={feedId} colorMode="light">
        <>
          <NotificationIconButton
            ref={triggerRef}
            aria-label="Notifications"
            badgeCountType="unread"
            onClick={() => setIsVisible((prev) => !prev)}
          />
          <NotificationFeedPopover
            buttonRef={triggerRef}
            isVisible={isVisible}
            onClose={() => setIsVisible(false)}
            placement="bottom-end"
            initialFilterStatus={FilterStatus.Unread}
            maxHeight={480}
            renderHeader={({ unreadCount, onMarkAllAsRead }) => (
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Inbox
                  </p>
                  <p className="text-xs text-gray-500">
                    {unreadCount > 0
                      ? `${unreadCount} unread`
                      : "You're all caught up"}
                  </p>
                </div>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={onMarkAllAsRead}
                    className="text-xs font-semibold text-chimera-teal hover:text-chimera-purple"
                  >
                    Mark all as read
                  </button>
                ) : null}
              </div>
            )}
            emptyState={
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-gray-500">
                <span className="text-2xl">🎉</span>
                <p>No notifications yet.</p>
                <p className="text-xs text-gray-400">
                  Updates from your workflows will show up here.
                </p>
              </div>
            }
          />
        </>
      </KnockFeedProvider>
    </KnockProvider>
  );
}
