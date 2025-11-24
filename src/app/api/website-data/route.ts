import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();

  const [leads, bookings, audience, startups] = await Promise.all([
    supabase
      .from("sales_leads")
      .select(
        "id, name, email, company, status, timeline, current_solution, utm_source, landing_page, referrer, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select(
        "id, lead_email, event_title, start_time, timezone, meeting_url, status, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("audience")
      .select(
        "id, email, first_name, last_name, source, tags, customer_fit_score, utm_source, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("startup_applications")
      .select(
        "id, company_name, email, website, status, program_tier, total_funding, seats_needed, use_case, created_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  if (leads.error || bookings.error || audience.error || startups.error) {
    console.error("Failed to load website data", {
      leads: leads.error,
      bookings: bookings.error,
      audience: audience.error,
      startups: startups.error,
    });
    return NextResponse.json(
      { error: "Failed to load website data." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    leads: leads.data ?? [],
    bookings: bookings.data ?? [],
    audience: audience.data ?? [],
    startups: startups.data ?? [],
  });
}
