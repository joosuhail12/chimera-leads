"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KnockInbox } from "@/components/notifications/knock-inbox";

interface DashboardShellProps {
  children: React.ReactNode;
  userId?: string;
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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7h18M3 12h18M3 17h18"
        />
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
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 5h18M3 12h18M3 19h18"
        />
      </svg>
    ),
  },
];

export function DashboardShell({ children, userId }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="relative isolate min-h-[100dvh] bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_45%),_radial-gradient(circle_at_bottom,_rgba(147,51,234,0.12),_transparent_40%)]"
      />
      <div className="relative mx-auto flex min-h-[100dvh] max-h-[100dvh] w-full max-w-[1440px] overflow-hidden px-3 py-4 sm:px-6 lg:px-10">
        <div className="flex w-full overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_25px_80px_-40px_rgba(15,23,42,0.65)] backdrop-blur-2xl dark:border-white/10 dark:bg-gray-950/70">
          <aside className="hidden h-full w-64 flex-col overflow-y-auto border-r border-white/60 px-4 py-6 dark:border-gray-900/60 md:flex">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-gray-900/70">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-chimera-teal to-chimera-purple text-white shadow-lg shadow-chimera-teal/40">
                <span className="text-lg font-bold">C</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  Chimera
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Revenue Workbench
                </span>
              </div>
            </Link>

            <div className="mt-8 space-y-2">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Navigation
              </p>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex flex-col gap-1 rounded-2xl border px-3 py-3 text-sm transition ${
                      isActive
                        ? "border-chimera-teal/40 bg-white/90 text-chimera-teal shadow-sm"
                        : "border-transparent text-gray-600 hover:border-white/70 hover:bg-white/70 dark:text-gray-300 dark:hover:border-gray-800/80"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className={`rounded-xl p-1.5 ${
                          isActive
                            ? "bg-gradient-to-br from-chimera-teal/20 to-chimera-purple/20 text-chimera-teal"
                            : "bg-gray-200/70 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {item.icon}
                      </span>
                      {item.label}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </span>
                    {isActive ? (
                      <span className="absolute inset-y-3 -left-1 w-1 rounded-full bg-gradient-to-b from-chimera-teal to-chimera-purple" />
                    ) : null}
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-gradient-to-br from-white to-gray-50 p-4 shadow-inner dark:border-white/10 dark:from-gray-900 dark:to-gray-950">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Account
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Manage profile
                  </p>
                </div>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox:
                        "h-10 w-10 rounded-full border border-gray-200 dark:border-gray-700",
                    },
                  }}
                />
              </div>

              <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-gray-50 to-white p-4 shadow-inner dark:border-white/10 dark:from-gray-900 dark:to-gray-950">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Need something custom?
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  We can help wire in new data sources or metrics as your
                  workflow evolves.
                </p>
                <Link
                  href="mailto:support@getpullse.com?subject=Chimera%20Dashboard"
                  className="mt-3 inline-flex items-center justify-center rounded-lg border border-chimera-teal/40 px-3 py-1.5 text-xs font-semibold text-chimera-teal transition-colors hover:bg-chimera-teal/10"
                >
                  Contact support
                </Link>
              </div>
            </div>
          </aside>

          <div className="flex flex-1 flex-col">
            <header className="shrink-0 border-b border-white/60 bg-white/70 px-4 py-5 backdrop-blur-md dark:border-gray-900/60 dark:bg-gray-950/60 md:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
                    Command center
                  </p>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                    GTM performance overview
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Monitor leads, meetings, and applications from a single pane
                    of glass.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="https://chimera.getpullse.com"
                    className="hidden rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-chimera-teal/30 hover:text-chimera-teal dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300 md:inline-flex"
                  >
                    View marketing site
                  </Link>
                  <Link
                    href="mailto:hello@getpullse.com?subject=Chimera%20Feedback"
                    className="hidden rounded-xl bg-gradient-to-r from-chimera-teal to-chimera-purple px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-chimera-teal/30 transition hover:shadow-lg md:inline-flex"
                  >
                    Share feedback
                  </Link>
                  {userId ? <KnockInbox userId={userId} /> : null}
                  <OrganizationSwitcher
                    hidePersonal
                    appearance={{
                      elements: {
                        organizationSwitcherTrigger:
                          "rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-chimera-teal/40 hover:text-chimera-teal dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200",
                      },
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={`mobile-${item.href}`}
                      href={item.href}
                      className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                        isActive
                          ? "bg-gradient-to-r from-chimera-teal to-chimera-purple text-white shadow"
                          : "bg-white/80 text-gray-600 dark:bg-gray-900/60 dark:text-gray-300"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8 lg:px-12">
              <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
