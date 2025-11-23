import type { SupabaseClient } from "@supabase/supabase-js";
import type { StartupWebhookPayload } from "@/lib/ingest/schemas";

type DB = SupabaseClient;

const nowISO = () => new Date().toISOString();

export async function upsertStartupApplication(
  supabase: DB,
  payload: StartupWebhookPayload
): Promise<string> {
  const normalizedEmail = payload.email.toLowerCase();
  let existingId: string | null = null;

  if (payload.id) {
    const { data, error } = await supabase
      .from("startup_applications")
      .select("id")
      .eq("original_id", payload.id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch startup application by original id: ${error.message}`
      );
    }

    existingId = data?.id ?? null;
  }

  if (!existingId) {
    const { data, error } = await supabase
      .from("startup_applications")
      .select("id")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch startup application by email: ${error.message}`
      );
    }

    existingId = data?.id ?? null;
  }

  const baseRecord = {
    original_id: payload.id,
    company_name: payload.company_name,
    website: payload.website,
    email: normalizedEmail,
    founding_date: payload.founding_date ?? null,
    annual_revenue: payload.annual_revenue ?? null,
    total_funding: payload.total_funding ?? null,
    seats_needed: payload.seats_needed ?? null,
    customer_status: payload.customer_status ?? null,
    current_tools: payload.current_tools ?? null,
    use_case: payload.use_case ?? null,
    utm_source: payload.utm_source ?? null,
    utm_medium: payload.utm_medium ?? null,
    utm_campaign: payload.utm_campaign ?? null,
    raw_payload: payload,
    updated_at: nowISO(),
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("startup_applications")
      .update(baseRecord)
      .eq("id", existingId)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to update startup application: ${
          error?.message ?? "unknown error"
        }`
      );
    }

    return data.id;
  }

  const insertPayload = {
    ...baseRecord,
    created_at: nowISO(),
  };

  const { data, error } = await supabase
    .from("startup_applications")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to insert startup application: ${error?.message ?? "unknown error"}`
    );
  }

  return data.id;
}
