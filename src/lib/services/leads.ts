import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesWebhookPayload } from "@/lib/ingest/schemas";

type DB = SupabaseClient;

const nowISO = () => new Date().toISOString();

export async function upsertSalesLead(
  supabase: DB,
  payload: SalesWebhookPayload
): Promise<string> {
  const normalizedEmail = payload.email.toLowerCase();
  let existingId: string | null = null;

  if (payload.id) {
    const { data, error } = await supabase
      .from("sales_leads")
      .select("id")
      .eq("original_id", payload.id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch sales lead by original id: ${error.message}`);
    }

    existingId = data?.id ?? null;
  }

  if (!existingId) {
    const { data, error } = await supabase
      .from("sales_leads")
      .select("id")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch sales lead by email: ${error.message}`);
    }

    existingId = data?.id ?? null;
  }

  const baseRecord = {
    original_id: payload.id,
    name: payload.name,
    email: normalizedEmail,
    company: payload.company,
    company_size: payload.company_size ?? null,
    industry: payload.industry ?? null,
    timeline: payload.timeline ?? null,
    phone: payload.phone ?? null,
    current_solution: payload.current_solution ?? null,
    message: payload.message ?? null,
    utm_source: payload.utm_source ?? null,
    utm_medium: payload.utm_medium ?? null,
    utm_campaign: payload.utm_campaign ?? null,
    utm_term: payload.utm_term ?? null,
    utm_content: payload.utm_content ?? null,
    referrer: payload.referrer ?? null,
    landing_page: payload.landing_page ?? null,
    raw_payload: payload,
    updated_at: nowISO(),
  };

  if (existingId) {
    const { data, error } = await supabase
      .from("sales_leads")
      .update(baseRecord)
      .eq("id", existingId)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to update existing sales lead: ${error?.message ?? "unknown error"}`
      );
    }

    return data.id;
  }

  const insertPayload = {
    ...baseRecord,
    created_at: nowISO(),
  };

  const { data, error } = await supabase
    .from("sales_leads")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to insert sales lead: ${error?.message ?? "unknown error"}`
    );
  }

  return data.id;
}
