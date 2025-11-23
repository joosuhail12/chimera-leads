import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewsletterWebhookPayload } from "@/lib/ingest/schemas";

type DB = SupabaseClient;

export async function upsertAudienceMember(
  supabase: DB,
  payload: NewsletterWebhookPayload
): Promise<string> {
  const normalizedEmail = payload.email.toLowerCase();

  const baseRecord = {
    email: normalizedEmail,
    first_name: payload.first_name ?? null,
    last_name: payload.last_name ?? null,
    source: payload.source ?? "web",
    is_active: true,
    utm_source: payload.attribution?.utm_source ?? null,
    utm_medium: payload.attribution?.utm_medium ?? null,
    utm_campaign: payload.attribution?.utm_campaign ?? null,
    raw_payload: payload,
  };

  const { data, error } = await supabase
    .from("audience")
    .upsert(baseRecord, { onConflict: "email" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to upsert audience member: ${error?.message ?? "unknown error"}`
    );
  }

  return data.id;
}
