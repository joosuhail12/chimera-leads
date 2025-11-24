"use client";

import { useState } from "react";
import {
  KnockProvider,
  KnockFeedProvider,
  NotificationFeed,
  NotificationIconButton,
} from "@knocklabs/react";
import "@knocklabs/react/dist/index.css";

type KnockInboxProps = {
  userId: string;
};

const publicApiKey = process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY;
const feedId = process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;

export function KnockInbox({ userId }: KnockInboxProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!publicApiKey || !feedId) {
    return null;
  }

  return (
    <KnockProvider apiKey={publicApiKey} user={{ id: userId }}>
      <KnockFeedProvider feedId={feedId} colorMode="light">
        <div className="relative flex items-center">
          <NotificationIconButton
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label="Notifications"
          />
          {isOpen ? (
            <div className="absolute right-0 top-10 z-50 w-[360px] rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
              <NotificationFeed />
            </div>
          ) : null}
        </div>
      </KnockFeedProvider>
    </KnockProvider>
  );
}
