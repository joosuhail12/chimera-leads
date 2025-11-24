import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PIPELINE_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "demo_scheduled",
  "negotiation",
] as const;

type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

function startOfCurrentWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) - 6 (Sat)
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  const start = new Date(now);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const weekStart = startOfCurrentWeek();

  const pipelinePromises = PIPELINE_STATUSES.map((status) =>
    supabase
      .from("sales_leads")
      .select("*", { count: "exact", head: true })
      .eq("status", status)
  );

  const [
    totalLeadsRes,
    openLeadsRes,
    thisWeekLeadsRes,
    totalBookingsRes,
    upcomingBookingsRes,
    startupAppsRes,
    audienceRes,
    recentActivityRes,
    nextBookingRes,
    ...pipelineRes
  ] = await Promise.all([
    supabase.from("sales_leads").select("*", { count: "exact", head: true }),
    supabase
      .from("sales_leads")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("closed_won","closed_lost","spam")'),
    supabase
      .from("sales_leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString()),
    supabase.from("bookings").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("start_time", now.toISOString()),
    supabase
      .from("startup_applications")
      .select("*", { count: "exact", head: true }),
    supabase.from("audience").select("*", { count: "exact", head: true }),
    supabase
      .from("sales_leads")
      .select("id,name,company,status,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select("id,event_title,start_time,lead_email,meeting_url")
      .gte("start_time", now.toISOString())
      .order("start_time", { ascending: true })
      .limit(1),
    ...pipelinePromises,
  ]);

  const allErrors = [
    totalLeadsRes.error,
    openLeadsRes.error,
    thisWeekLeadsRes.error,
    totalBookingsRes.error,
    upcomingBookingsRes.error,
    startupAppsRes.error,
    audienceRes.error,
    recentActivityRes.error,
    nextBookingRes.error,
    ...pipelineRes.map((res) => res.error),
  ].filter(Boolean);

  if (allErrors.length) {
    console.error("Dashboard summary error", allErrors[0]);
    return NextResponse.json(
      { error: "Failed to load dashboard summary." },
      { status: 500 }
    );
  }

  const pipeline: Record<PipelineStatus, number> = {
    new: pipelineRes[0].count ?? 0,
    contacted: pipelineRes[1].count ?? 0,
    qualified: pipelineRes[2].count ?? 0,
    demo_scheduled: pipelineRes[3].count ?? 0,
    negotiation: pipelineRes[4].count ?? 0,
  };

  const recentActivity =
    recentActivityRes.data?.map((lead) => ({
      id: lead.id,
      title: `Lead ${lead.status?.replace("_", " ") ?? "updated"}`,
      company: lead.company,
      updated_at: lead.updated_at,
    })) ?? [];

  const nextBooking = nextBookingRes.data?.[0]
    ? {
        id: nextBookingRes.data[0].id,
        event_title: nextBookingRes.data[0].event_title,
        start_time: nextBookingRes.data[0].start_time,
        lead_email: nextBookingRes.data[0].lead_email,
        meeting_url: nextBookingRes.data[0].meeting_url,
      }
    : null;

  return NextResponse.json({
    totals: {
      leads: totalLeadsRes.count ?? 0,
      openLeads: openLeadsRes.count ?? 0,
      thisWeekLeads: thisWeekLeadsRes.count ?? 0,
      bookings: totalBookingsRes.count ?? 0,
      upcomingMeetings: upcomingBookingsRes.count ?? 0,
      startupApplications: startupAppsRes.count ?? 0,
      newsletterSubscribers: audienceRes.count ?? 0,
    },
    pipeline,
    recentActivity,
    nextMeeting: nextBooking,
  });
}
