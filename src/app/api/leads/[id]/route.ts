import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_STATUSES } from "@/lib/constants/leads";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  const [{ data: lead, error: leadError }, { data: bookings, error: bookingError }] =
    await Promise.all([
      supabase
        .from("sales_leads")
        .select(
          "id, name, email, phone, company, status, message, current_solution, timeline, created_at, updated_at, assigned_to, admin_notes, raw_payload"
        )
        .eq("id", id)
        .single(),
      supabase
        .from("bookings")
        .select("id, event_title, start_time, meeting_url, status")
        .eq("lead_id", id)
        .order("start_time", { ascending: true }),
    ]);

  if (leadError || !lead) {
    console.error("Lead lookup failed", leadError);
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (bookingError) {
    console.error("Booking lookup failed", bookingError);
  }

  return NextResponse.json({
    lead,
    bookings: bookings ?? [],
    statusMeta:
      LEAD_STATUSES.find((status) => status.value === lead.status) ?? null,
  });
}
