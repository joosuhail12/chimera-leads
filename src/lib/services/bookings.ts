import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingWebhookPayload } from "@/lib/ingest/schemas";

type DB = SupabaseClient;

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return null;
  }
  return parsed.toISOString();
};

async function findLeadIdByEmail(
  supabase: DB,
  email?: string | null
): Promise<string | null> {
  if (!email) {
    return null;
  }

  const normalized = email.toLowerCase();
  const { data, error } = await supabase
    .from("sales_leads")
    .select("id")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to locate sales lead for booking: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function upsertBooking(
  supabase: DB,
  payload: BookingWebhookPayload
): Promise<string> {
  const leadEmail = payload.email?.toLowerCase() ?? null;
  const leadId = await findLeadIdByEmail(supabase, payload.email ?? null);

  const startTime = parseTimestamp(payload.start_time);
  const endTime = parseTimestamp(payload.end_time);

  const baseRecord = {
    lead_id: leadId,
    lead_email: leadEmail,
    event_title: payload.event_title ?? payload.name ?? null,
    start_time: startTime,
    end_time: endTime,
    timezone: payload.timezone ?? null,
    location: payload.location ?? null,
    meeting_url: payload.meeting_url ?? null,
    notes: payload.notes ?? null,
    status: "scheduled" as const,
    raw_data: payload.raw ?? payload,
  };

  let existingId: string | null = null;

  if (leadEmail && startTime) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("lead_email", leadEmail)
      .eq("start_time", startTime)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to locate existing booking: ${error.message}`);
    }

    existingId = data?.id ?? null;
  }

  if (!existingId && payload.meeting_url) {
    const { data, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("meeting_url", payload.meeting_url)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to locate existing booking by meeting url: ${error.message}`
      );
    }

    existingId = data?.id ?? null;
  }

  if (existingId) {
    const { data, error } = await supabase
      .from("bookings")
      .update(baseRecord)
      .eq("id", existingId)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to update booking: ${error?.message ?? "unknown error"}`
      );
    }

    return data.id;
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert(baseRecord)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to insert booking: ${error?.message ?? "unknown error"}`
    );
  }

  return data.id;
}
