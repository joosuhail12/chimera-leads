"use client";

import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  category: string;
  status: "unread" | "read";
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/notifications");
        if (response.ok) {
          const data = (await response.json()) as {
            notifications: NotificationItem[];
          };
          setNotifications(data.notifications);
        }
      } catch (error) {
        console.error("Failed to load notifications", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const unreadCount = notifications.filter(
    (notification) => notification.status === "unread"
  ).length;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-600"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-1 text-[11px] font-semibold text-white shadow-sm">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 z-20 mt-3 w-[320px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-300/50 backdrop-blur">
          <div className="flex items-center justify-between px-2 pb-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Notifications
              </p>
              <p className="text-xs text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : "All caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setNotifications((items) =>
                  items.map((item) => ({ ...item, status: "read" }))
                )
              }
              className="text-xs font-semibold text-sky-600 hover:text-sky-500"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="rounded-xl border border-slate-100/80 bg-slate-50/80 p-4 text-sm text-slate-500">
                Loading notifications…
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-slate-100/80 bg-slate-50/80 p-4 text-center text-sm text-slate-500">
                You have no notifications.
              </div>
            ) : (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`rounded-xl border p-3 transition ${
                    notification.status === "unread"
                      ? "border-sky-100 bg-sky-50/60"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    {notification.category}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {notification.title}
                  </p>
                  <p className="text-xs text-slate-500">{notification.body}</p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
