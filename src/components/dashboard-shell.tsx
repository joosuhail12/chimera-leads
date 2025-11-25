"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
}

const navItems = [
  {
    label: "Overview",
    description: "Pipeline snapshot & insights",
    href: "/dashboard",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: "Pipeline",
    description: "Drag & drop deal stages",
    href: "/dashboard/pipeline",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
      </svg>
    ),
  },
  {
    label: "Website Data",
    description: "All ingested form submissions",
    href: "/dashboard/website-data",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M3 12h18M3 19h18" />
      </svg>
    ),
  },
  {
    label: "Marketing",
    description: "Subscriber lists & campaigns",
    href: "/dashboard/marketing-lists",
    icon: (
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6m16-6v6m0-6a2 2 0 00-2-2h-3.172a2 2 0 01-1.414-.586l-1.828-1.828A2 2 0 009.172 2H6a2 2 0 00-2 2v6h16z"
        />
      </svg>
    ),
  },
];

const NotificationBellClient = dynamic(
  () =>
    import("@/components/notifications/notification-bell").then(
      (mod) => mod.NotificationBell
    ),
  { ssr: false }
);

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="relative isolate h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#f6f9ff] via-white to-white text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-8 h-80 w-80 rounded-full bg-sky-200/70 blur-[150px]" />
        <div className="absolute bottom-[-140px] right-6 h-96 w-96 rounded-full bg-pink-200/60 blur-[170px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_50%),_radial-gradient(circle_at_bottom,_rgba(236,72,153,0.1),_transparent_45%)]" />
      </div>
      <div className="relative z-10 flex h-full w-full">
        <aside
          className={`hidden h-full flex-col overflow-y-auto border-r border-slate-200 bg-white/90 py-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.6)] backdrop-blur-md transition-all duration-300 md:flex ${
            isSidebarOpen ? "w-64 px-5" : "w-20 px-3"
          }`}
        >
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-2xl border border-white bg-white p-3 shadow-md shadow-slate-200/90 transition ${
              isSidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-300/70">
              <span className="text-lg font-bold">C</span>
            </div>
            {isSidebarOpen ? (
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-slate-900">
                  Chimera
                </span>
                <span className="text-xs text-slate-500">Revenue Workbench</span>
              </div>
            ) : null}
          </Link>

          <div className="mt-8 space-y-2">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {isSidebarOpen ? "Navigation" : "Nav"}
            </p>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex flex-col gap-1 rounded-2xl border px-3 py-3 text-sm transition ${
                    isActive
                      ? "border-sky-200 bg-gradient-to-r from-sky-100 via-cyan-100 to-indigo-100 text-sky-700 shadow-[0_25px_45px_-30px_rgba(14,165,233,0.9)]"
                      : "border-transparent text-slate-500 hover:border-slate-100 hover:bg-slate-50/80"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className={`rounded-xl p-1.5 ${
                        isActive ? "bg-white text-slate-900 shadow" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {item.icon}
                    </span>
                    {isSidebarOpen ? item.label : null}
                  </span>
                  {isSidebarOpen ? (
                    <span className="text-xs text-slate-400">{item.description}</span>
                  ) : null}
                  {isActive && isSidebarOpen ? (
                    <span className="absolute inset-y-3 -left-2 w-1 rounded-full bg-gradient-to-b from-sky-400 via-cyan-400 to-indigo-400 shadow-[0_0_14px_rgba(14,165,233,0.5)]" />
                  ) : null}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto space-y-4">
            <div
              className={`flex items-center justify-between rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4 shadow-inner ${
                isSidebarOpen ? "gap-2" : "flex-col gap-3 text-center"
              }`}
            >
              {isSidebarOpen ? (
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Account
                  </p>
                  <p className="text-sm font-medium text-slate-900">Manage profile</p>
                </div>
              ) : (
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Account
                </p>
              )}
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-10 w-10 rounded-full border border-slate-200",
                  },
                }}
              />
            </div>
          </div>
        </aside>

        <div className="flex h-full flex-1 flex-col overflow-hidden border-l border-slate-200/70 bg-white/90 text-slate-900 backdrop-blur-md">
          <header className="shrink-0 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-md md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                  onClick={() => setIsSidebarOpen((prev) => !prev)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-sky-200 hover:text-sky-600"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    {isSidebarOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6L6 18M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h12M4 12h16M4 18h12" />
                    )}
                  </svg>
                </button>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Command center
                  </p>
                  <h1 className="text-3xl font-semibold text-slate-900">GTM performance overview</h1>
                  <p className="text-sm text-slate-500">
                    Monitor leads, meetings, and applications from a single pane of glass.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="https://chimera.getpullse.com"
                  className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-sky-200 hover:text-sky-600 md:inline-flex"
                >
                  View marketing site
                </Link>
                <Link
                  href="mailto:hello@getpullse.com?subject=Chimera%20Feedback"
                  className="hidden rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-sky-300/70 transition hover:shadow-lg md:inline-flex"
                >
                  Share feedback
                </Link>
                <NotificationBellClient />
                <OrganizationSwitcher
                  hidePersonal
                  appearance={{
                    elements: {
                      organizationSwitcherTrigger:
                        "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-sky-600",
                    },
                  }}
                />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-12">
            <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
