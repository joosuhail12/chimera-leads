import { currentUser } from "@clerk/nextjs/server";
import { resolveBaseUrl } from "@/lib/utils/resolve-base-url";

type DashboardSummary = {
  totals: {
    leads: number;
    openLeads: number;
    thisWeekLeads: number;
    bookings: number;
    upcomingMeetings: number;
    startupApplications: number;
    newsletterSubscribers: number;
  };
  pipeline: Record<
    "new" | "contacted" | "qualified" | "demo_scheduled" | "negotiation",
    number
  >;
  recentActivity: Array<{
    id: string;
    title: string;
    company: string | null;
    updated_at: string;
  }>;
  nextMeeting: {
    id: string;
    event_title: string | null;
    start_time: string | null;
    lead_email: string | null;
    meeting_url: string | null;
  } | null;
};

async function fetchDashboardSummary(): Promise<DashboardSummary | null> {
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/dashboard/summary`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as DashboardSummary;
  } catch (error) {
    console.error("Failed to load dashboard summary", error);
    return null;
  }
}

export default async function DashboardPage() {
  const user = await currentUser();
  const summary = await fetchDashboardSummary();

  const totalLeads = summary?.totals.leads ?? 0;
  const openLeads = summary?.totals.openLeads ?? 0;
  const thisWeekLeads = summary?.totals.thisWeekLeads ?? 0;
  const totalBookings = summary?.totals.bookings ?? 0;
  const upcomingMeetings = summary?.totals.upcomingMeetings ?? 0;

  const pipelineData =
    summary?.pipeline ??
    ({
      new: 0,
      contacted: 0,
      qualified: 0,
      demo_scheduled: 0,
      negotiation: 0,
    } as DashboardSummary["pipeline"]);

  const recentActivity = summary?.recentActivity ?? [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="rounded-xl border border-chimera-teal/20 bg-gradient-to-br from-white via-chimera-teal/5 to-chimera-purple/5 p-6 shadow-sm shadow-chimera-teal/5 dark:from-gray-900 dark:via-chimera-teal/5 dark:to-chimera-purple/5 dark:border-chimera-teal/30">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold bg-gradient-to-r from-chimera-teal to-chimera-purple bg-clip-text text-transparent">
              Welcome back, {user?.firstName}!
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Here&apos;s what&apos;s happening with your pipeline today
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-xs text-chimera-teal dark:text-chimera-teal">Today</div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="group rounded-xl border border-chimera-teal/20 bg-white p-6 shadow-sm transition-all hover:border-chimera-teal/40 hover:shadow-lg hover:shadow-chimera-teal/10 dark:border-chimera-teal/30 dark:bg-gray-900 dark:hover:border-chimera-teal/50">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-chimera-teal to-chimera-teal/80 shadow-lg shadow-chimera-teal/20">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Leads</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {totalLeads.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm">
              <span className="font-medium text-chimera-teal">
                {thisWeekLeads} this week
              </span>
              <span className="text-gray-500 dark:text-gray-400">new records</span>
            </div>
          </div>
        </div>

        <div className="group rounded-xl border border-chimera-purple/20 bg-white p-6 shadow-sm transition-all hover:border-chimera-purple/40 hover:shadow-lg hover:shadow-chimera-purple/10 dark:border-chimera-purple/30 dark:bg-gray-900 dark:hover:border-chimera-purple/50">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-chimera-purple to-chimera-purple/80 shadow-lg shadow-chimera-purple/20">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Pipeline</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {openLeads.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm">
              <span className="font-medium text-chimera-purple">
                {pipelineData.negotiation} in negotiation
              </span>
              <span className="text-gray-500 dark:text-gray-400">currently open</span>
            </div>
          </div>
        </div>

        <div className="group rounded-xl border border-chimera-lime/20 bg-white p-6 shadow-sm transition-all hover:border-chimera-lime/40 hover:shadow-lg hover:shadow-chimera-lime/10 dark:border-chimera-lime/30 dark:bg-gray-900 dark:hover:border-chimera-lime/50">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-chimera-lime to-chimera-lime/80 shadow-lg shadow-chimera-lime/20">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Startup Applications</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {summary?.totals.startupApplications.toLocaleString() ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm">
              <span className="font-medium text-chimera-lime">
                {summary?.totals.newsletterSubscribers.toLocaleString() ?? 0} audience
              </span>
              <span className="text-gray-500 dark:text-gray-400">newsletter subscribers</span>
            </div>
          </div>
        </div>

        <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-gray-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-chimera-teal via-chimera-purple to-chimera-lime shadow-lg shadow-gray-400/20">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Meetings Scheduled</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
              {totalBookings.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm">
              <span className="font-medium bg-gradient-to-r from-chimera-teal to-chimera-purple bg-clip-text text-transparent">
                {upcomingMeetings} upcoming
              </span>
              <span className="text-gray-500 dark:text-gray-400">in the calendar</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Overview & Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline Overview */}
        <div className="rounded-xl border border-chimera-teal/10 bg-white p-6 shadow-sm dark:border-chimera-teal/20 dark:bg-gray-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-chimera-teal to-chimera-purple bg-clip-text text-transparent">Pipeline Overview</h2>
            <button className="text-sm font-medium text-chimera-teal transition-colors hover:text-chimera-purple">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {[
              { stage: "New Leads", value: pipelineData.new, color: "bg-chimera-teal" },
              { stage: "Contacted", value: pipelineData.contacted, color: "bg-chimera-purple" },
              { stage: "Qualified", value: pipelineData.qualified, color: "bg-chimera-lime" },
              { stage: "Demo Scheduled", value: pipelineData.demo_scheduled, color: "bg-chimera-purple/60" },
              { stage: "Negotiation", value: pipelineData.negotiation, color: "bg-gray-400" },
            ].map((item) => {
              const percentage =
                totalLeads > 0 ? Math.round((item.value / totalLeads) * 100) : 0;
              return (
                <div key={item.stage}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.stage}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {item.value}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                      className={`${item.color} h-full rounded-full transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-chimera-purple/10 bg-white p-6 shadow-sm dark:border-chimera-purple/20 dark:bg-gray-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-chimera-purple to-chimera-lime bg-clip-text text-transparent">Recent Activity</h2>
            <button className="text-sm font-medium text-chimera-purple transition-colors hover:text-chimera-lime">
              View All
            </button>
          </div>
          <div className="space-y-4">
            {(recentActivity.length ? recentActivity : [
              {
                id: "placeholder",
                title: "No recent activity",
                company: "Get started by ingesting webhooks.",
                updated_at: new Date().toISOString(),
              },
            ]).map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 border-l-2 border-gray-200 pl-4 dark:border-gray-800"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activity.title}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 truncate">
                    {activity.company ?? "—"}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {new Date(activity.updated_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Performers & Upcoming Tasks */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <div className="rounded-xl border border-chimera-lime/10 bg-white p-6 shadow-sm dark:border-chimera-lime/20 dark:bg-gray-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-chimera-lime to-chimera-teal bg-clip-text text-transparent">Top Performers</h2>
            <button className="text-sm font-medium text-chimera-lime transition-colors hover:text-chimera-teal">
              This Month
            </button>
          </div>
          <div className="space-y-4">
            {[
              { name: "Sarah Johnson", deals: 24, revenue: "$128K", rank: 1 },
              { name: "Mike Chen", deals: 19, revenue: "$98K", rank: 2 },
              { name: "Emily Rodriguez", deals: 17, revenue: "$87K", rank: 3 },
              { name: "David Kim", deals: 15, revenue: "$76K", rank: 4 },
            ].map((performer) => (
              <div
                key={performer.rank}
                className="flex items-center gap-4"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-chimera-teal to-chimera-purple text-sm font-semibold text-white">
                  {performer.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{performer.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{performer.deals} deals closed</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-chimera-teal">{performer.revenue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="rounded-xl border border-chimera-teal/10 bg-white p-6 shadow-sm dark:border-chimera-teal/20 dark:bg-gray-900">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold bg-gradient-to-r from-chimera-teal to-chimera-purple bg-clip-text text-transparent">Upcoming Tasks</h2>
            <button className="text-sm font-medium text-chimera-teal transition-colors hover:text-chimera-purple">
              Add Task
            </button>
          </div>
          <div className="space-y-3">
            {[
              { task: "Follow up with TechCorp", due: "Today, 2:00 PM", priority: "high" },
              { task: "Send proposal to DataSys", due: "Today, 4:30 PM", priority: "high" },
              { task: "Schedule demo for CloudNet", due: "Tomorrow, 10:00 AM", priority: "medium" },
              { task: "Review contract terms", due: "Tomorrow, 3:00 PM", priority: "medium" },
              { task: "Team sync meeting", due: "Friday, 9:00 AM", priority: "low" },
            ].map((task, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 cursor-pointer rounded border-gray-300 text-chimera-teal focus:ring-chimera-teal focus:ring-offset-0 dark:border-gray-700"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{task.task}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">{task.due}</div>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                    task.priority === "high"
                      ? "bg-chimera-teal/10 text-chimera-teal"
                      : task.priority === "medium"
                      ? "bg-chimera-purple/10 text-chimera-purple"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
