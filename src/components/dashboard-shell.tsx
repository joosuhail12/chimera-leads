"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Users,
  Briefcase,
  Workflow,
  PieChart,
  Database,
  Mail,
  ListFilter,
  Settings,
  FileText,
  ChevronLeft,
  ChevronRight,
  Menu,
  Building2,
} from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
}

type NavSection = "common" | "marketing" | "crm" | "startups" | "workflows" | "settings";

const mainNavItems = [
  {
    id: "common",
    label: "Common",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    path: "/dashboard/marketing-lists",
  },
  {
    id: "crm",
    label: "CRM",
    icon: Users,
    path: "/dashboard/pipeline",
  },
  {
    id: "startups",
    label: "Startups",
    icon: Briefcase,
    path: "/dashboard/startups",
  },
  {
    id: "workflows",
    label: "Workflows",
    icon: Workflow,
    path: "/dashboard/workflows",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    path: "/dashboard/settings",
  },
] as const;

const secondaryNavItems: Record<
  NavSection,
  Array<{
    label: string;
    description: string;
    href: string;
    icon: React.ElementType;
  }>
> = {
  common: [
    {
      label: "Overview",
      description: "Pipeline snapshot & insights",
      href: "/dashboard",
      icon: PieChart,
    },
    {
      label: "Website Data",
      description: "All ingested form submissions",
      href: "/dashboard/website-data",
      icon: Database,
    },
  ],
  marketing: [
    {
      label: "Marketing Lists",
      description: "Subscriber lists & campaigns",
      href: "/dashboard/marketing-lists",
      icon: ListFilter,
    },
    {
      label: "Email Templates",
      description: "Design campaign layouts",
      href: "/dashboard/email-templates",
      icon: Mail,
    },
    {
      label: "Audience",
      description: "Newsletter contacts & tags",
      href: "/dashboard/audience",
      icon: Users,
    },
  ],
  crm: [
    {
      label: "Leads",
      description: "Manage potential customers",
      href: "/dashboard/leads",
      icon: Users,
    },
    {
      label: "Contacts",
      description: "People at accounts",
      href: "/dashboard/contacts",
      icon: Users,
    },
    {
      label: "Accounts",
      description: "Organizations & companies",
      href: "/dashboard/accounts",
      icon: Building2,
    },
    {
      label: "Pipeline",
      description: "Drag & drop deal stages",
      href: "/dashboard/pipeline",
      icon: Briefcase,
    },
    {
      label: "Sequences",
      description: "Automated outreach campaigns",
      href: "/dashboard/sequences",
      icon: Workflow,
    },
    {
      label: "Custom Fields",
      description: "Extend lead & audience records",
      href: "/dashboard/custom-fields",
      icon: Settings,
    },
  ],
  startups: [
    {
      label: "Applications",
      description: "Applications & diligence",
      href: "/dashboard/startups",
      icon: FileText,
    },
  ],
  workflows: [
    {
      label: "Workflows",
      description: "Automate business processes",
      href: "/dashboard/workflows",
      icon: Workflow,
    },
  ],
  settings: [
    {
      label: "Email & Domains",
      description: "Configure sending emails",
      href: "/dashboard/settings/email",
      icon: Mail,
    },
    {
      label: "Custom Fields",
      description: "Manage custom fields",
      href: "/dashboard/custom-fields",
      icon: Database,
    },
  ],
};

const NotificationBellClient = dynamic(
  () =>
    import("@/components/notifications/notification-bell").then(
      (mod) => mod.NotificationBell
    ),
  { ssr: false }
);

function getSectionFromPath(pathname: string): NavSection {
  if (pathname.startsWith("/dashboard/settings")) {
    return "settings";
  }
  if (pathname.startsWith("/dashboard/marketing-lists") ||
    pathname.startsWith("/dashboard/email-templates") ||
    pathname.startsWith("/dashboard/audience")) {
    return "marketing";
  }
  if (pathname.startsWith("/dashboard/pipeline") ||
    pathname.startsWith("/dashboard/leads") ||
    pathname.startsWith("/dashboard/contacts") ||
    pathname.startsWith("/dashboard/accounts") ||
    pathname.startsWith("/dashboard/sequences") ||
    pathname.startsWith("/dashboard/custom-fields")) {
    return "crm";
  }
  if (pathname.startsWith("/dashboard/startups")) {
    return "startups";
  }
  if (pathname.startsWith("/dashboard/workflows")) {
    return "workflows";
  }
  return "common";
}

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<NavSection>("common");
  const [isSecondarySidebarOpen, setIsSecondarySidebarOpen] = useState(true);

  // Sync active section with pathname on mount and route change
  useEffect(() => {
    if (pathname) {
      setActiveSection(getSectionFromPath(pathname));
    }
  }, [pathname]);

  const isBuilderPage =
    pathname?.startsWith("/dashboard/email-templates/") && pathname.includes("/editor");
  const mainPadding = isBuilderPage ? "px-3 py-4 md:px-6 lg:px-10" : "px-4 py-6 md:px-8 lg:px-12";
  const contentWidth = isBuilderPage ? "w-full space-y-6" : "mx-auto w-full max-w-6xl space-y-6";

  if (isBuilderPage) {
    return <div className="h-[100dvh] w-full bg-white text-slate-900">{children}</div>;
  }

  const handleMainSectionClick = (sectionId: NavSection, path: string) => {
    setActiveSection(sectionId);
    router.push(path);
    if (!isSecondarySidebarOpen) {
      setIsSecondarySidebarOpen(true);
    }
  };

  return (
    <div className="relative isolate h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#f6f9ff] via-white to-white text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-8 h-80 w-80 rounded-full bg-sky-200/70 blur-[150px]" />
        <div className="absolute bottom-[-140px] right-6 h-96 w-96 rounded-full bg-pink-200/60 blur-[170px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.1),_transparent_50%),_radial-gradient(circle_at_bottom,_rgba(236,72,153,0.1),_transparent_45%)]" />
      </div>

      <div className="relative z-10 flex h-full w-full">
        {/* Primary Sidebar (Left Strip) */}
        <aside className="hidden h-full w-20 flex-col items-center border-r border-slate-200 bg-white/95 py-6 backdrop-blur-md md:flex z-20">
          <Link
            href="/dashboard"
            className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-sky-300/70"
          >
            <span className="text-lg font-bold">C</span>
          </Link>

          <div className="flex flex-col gap-4 w-full px-3">
            {mainNavItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleMainSectionClick(item.id as NavSection, item.path)}
                  className={`group relative flex h-12 w-full items-center justify-center rounded-xl transition-all duration-200 ${isActive
                    ? "bg-sky-50 text-sky-600 shadow-sm"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                    }`}
                  title={item.label}
                >
                  <item.icon className="h-6 w-6" strokeWidth={1.5} />
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-sky-500" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-4 w-full px-3">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-10 w-10 rounded-full border border-slate-200",
                },
              }}
            />
          </div>
        </aside>

        {/* Secondary Sidebar (Expandable Panel) */}
        <aside
          className={`hidden h-full flex-col border-r border-slate-200 bg-white/50 backdrop-blur-md transition-all duration-300 md:flex ${isSecondarySidebarOpen ? "w-64" : "w-0 opacity-0 overflow-hidden border-none"
            }`}
        >
          <div className="flex h-full flex-col p-4">
            <div className="mb-6 flex items-center justify-between px-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                {mainNavItems.find(i => i.id === activeSection)?.label}
              </h2>
              <button
                onClick={() => setIsSecondarySidebarOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              {secondaryNavItems[activeSection].map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive
                      ? "bg-white text-sky-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:bg-white/60 hover:text-slate-700"
                      }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-sky-500" : "text-slate-400"}`} />
                    <div className="flex flex-col">
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex h-full flex-1 flex-col overflow-hidden bg-white/50 backdrop-blur-sm">
          <header className="shrink-0 border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur-md md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                {!isSecondarySidebarOpen && (
                  <button
                    onClick={() => setIsSecondarySidebarOpen(true)}
                    className="mr-2 hidden rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 md:block"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                )}
                {/* Mobile Menu Button (TODO: Implement mobile drawer) */}
                <button className="md:hidden rounded-lg border border-slate-200 p-2 text-slate-500">
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                    Command center
                  </p>
                  <h1 className="text-3xl font-semibold text-slate-900">GTM performance overview</h1>
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

          <main className={`flex-1 overflow-y-auto ${mainPadding}`}>
            <div className={contentWidth}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
