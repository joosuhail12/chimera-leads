"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-chimera-teal/5 via-gray-50 to-chimera-purple/5 dark:from-chimera-teal/5 dark:via-gray-950 dark:to-chimera-purple/5">
      {/* Subtle Background Accent */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-chimera-teal/10 via-transparent to-chimera-purple/10" />

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-chimera-teal/10 bg-white/80 backdrop-blur-xl shadow-lg shadow-chimera-teal/5 transition-all duration-300 dark:border-chimera-teal/20 dark:bg-gray-950/80 dark:shadow-chimera-teal/10 ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo & Brand */}
        <div className="border-b border-chimera-teal/10 px-6 py-5 dark:border-chimera-teal/20">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative flex-shrink-0 rounded-lg bg-gradient-to-br from-chimera-teal to-chimera-purple p-1.5 shadow-lg shadow-chimera-teal/20 transition-transform group-hover:scale-105">
              <Image
                src="/chimera-badge-logo.png"
                alt="Chimera"
                width={24}
                height={24}
              />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-lg font-semibold bg-gradient-to-r from-chimera-teal to-chimera-purple bg-clip-text text-transparent truncate">
                  Chimera
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Lead Management
                </div>
              </div>
            )}
          </Link>
        </div>

        {/* Quick Stats */}
        {!sidebarCollapsed && (
          <div className="border-b border-chimera-teal/10 p-4 dark:border-chimera-teal/20">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-gradient-to-br from-chimera-teal/5 to-chimera-purple/5 p-3">
              <div className="text-center">
                <div className="text-lg font-bold text-chimera-teal">247</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Leads
                </div>
              </div>
              <div className="border-x border-chimera-teal/10 text-center dark:border-chimera-teal/20">
                <div className="text-lg font-bold text-chimera-purple">89</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Active
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-chimera-lime">34</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Closed
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <Link
            href="/dashboard"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard")
                ? "bg-gradient-to-r from-chimera-teal to-chimera-teal/80 text-white shadow-lg shadow-chimera-teal/20"
                : "text-gray-700 hover:bg-chimera-teal/10 hover:text-chimera-teal dark:text-gray-300 dark:hover:bg-chimera-teal/20 dark:hover:text-chimera-teal"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            {!sidebarCollapsed && <span className="flex-1 truncate">Dashboard</span>}
          </Link>

          <Link
            href="/dashboard/leads"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard/leads")
                ? "bg-gradient-to-r from-chimera-purple to-chimera-purple/80 text-white shadow-lg shadow-chimera-purple/20"
                : "text-gray-700 hover:bg-chimera-purple/10 hover:text-chimera-purple dark:text-gray-300 dark:hover:bg-chimera-purple/20 dark:hover:text-chimera-purple"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {!sidebarCollapsed && <span className="flex-1 truncate">Leads</span>}
          </Link>

          <Link
            href="/dashboard/pipeline"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard/pipeline")
                ? "bg-gradient-to-r from-chimera-lime to-chimera-lime/80 text-white shadow-lg shadow-chimera-lime/20"
                : "text-gray-700 hover:bg-chimera-lime/10 hover:text-chimera-lime dark:text-gray-300 dark:hover:bg-chimera-lime/20 dark:hover:text-chimera-lime"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {!sidebarCollapsed && <span className="flex-1 truncate">Pipeline</span>}
          </Link>

          <Link
            href="/dashboard/analytics"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard/analytics")
                ? "bg-gradient-to-r from-chimera-teal to-chimera-purple text-white shadow-lg shadow-chimera-teal/20"
                : "text-gray-700 hover:bg-gradient-to-r hover:from-chimera-teal/10 hover:to-chimera-purple/10 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {!sidebarCollapsed && <span className="flex-1 truncate">Analytics</span>}
          </Link>

          {!sidebarCollapsed && (
            <>
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-chimera-teal/20 to-transparent" />

              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Workspace
              </div>
            </>
          )}

          <Link
            href="/dashboard/tasks"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard/tasks")
                ? "bg-gradient-to-r from-chimera-purple to-chimera-purple/80 text-white shadow-lg shadow-chimera-purple/20"
                : "text-gray-700 hover:bg-chimera-purple/10 hover:text-chimera-purple dark:text-gray-300 dark:hover:bg-chimera-purple/20 dark:hover:text-chimera-purple"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 truncate">Tasks</span>
                <span className="flex-shrink-0 rounded-full bg-chimera-purple/10 px-2 py-0.5 text-xs font-semibold text-chimera-purple">
                  12
                </span>
              </>
            )}
          </Link>

          <Link
            href="/dashboard/team"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard/team")
                ? "bg-gradient-to-r from-chimera-teal to-chimera-teal/80 text-white shadow-lg shadow-chimera-teal/20"
                : "text-gray-700 hover:bg-chimera-teal/10 hover:text-chimera-teal dark:text-gray-300 dark:hover:bg-chimera-teal/20 dark:hover:text-chimera-teal"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {!sidebarCollapsed && <span className="flex-1 truncate">Team</span>}
          </Link>

          {!sidebarCollapsed && (
            <div className="my-3 h-px bg-gradient-to-r from-transparent via-chimera-purple/20 to-transparent" />
          )}

          <Link
            href="/dashboard/settings"
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              isActive("/dashboard/settings")
                ? "bg-gradient-to-r from-gray-700 to-gray-600 text-white shadow-lg shadow-gray-700/20"
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            <svg
              className="h-5 w-5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {!sidebarCollapsed && <span className="flex-1 truncate">Settings</span>}
          </Link>
        </nav>

        {/* User Profile */}
        <div className="border-t border-chimera-teal/10 p-3 dark:border-chimera-teal/20">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 rounded-lg ring-2 ring-chimera-teal/20",
                },
              }}
            />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  Your Account
                </div>
                <div className="text-xs text-chimera-teal truncate">Premium</div>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-6 flex h-6 w-6 items-center justify-center rounded-full border border-chimera-teal/20 bg-white shadow-lg shadow-chimera-teal/10 transition-all hover:scale-110 hover:bg-chimera-teal hover:text-white dark:bg-gray-900 dark:shadow-chimera-teal/20"
        >
          <svg
            className={`h-3 w-3 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      </aside>

      {/* Main Content */}
      <div
        className={`relative z-10 flex-1 transition-all duration-300 ${
          sidebarCollapsed ? "ml-20" : "ml-64"
        }`}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-chimera-teal/10 bg-white/80 backdrop-blur-xl shadow-sm shadow-chimera-teal/5 dark:border-chimera-teal/20 dark:bg-gray-950/80 dark:shadow-chimera-teal/10">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="search"
                placeholder="Search leads, contacts..."
                className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-500 transition-all focus:border-chimera-teal focus:outline-none focus:ring-2 focus:ring-chimera-teal/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-chimera-teal"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <button className="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gradient-to-br hover:from-chimera-teal/10 hover:to-chimera-purple/10 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gradient-to-br dark:hover:from-chimera-teal/20 dark:hover:to-chimera-purple/20 dark:hover:text-gray-100">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="absolute right-1.5 top-1.5 block h-2 w-2 rounded-full bg-gradient-to-br from-chimera-teal to-chimera-purple ring-2 ring-white dark:ring-gray-950" />
              </button>

              {/* New Lead Button */}
              <button className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-chimera-teal to-chimera-purple px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-chimera-teal/20 transition-all hover:shadow-xl hover:shadow-chimera-teal/30 focus:outline-none focus:ring-2 focus:ring-chimera-teal focus:ring-offset-2 dark:focus:ring-offset-gray-950">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Lead
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
