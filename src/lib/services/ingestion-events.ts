import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient;

export type IngestionEventStatus = "success" | "error";

export interface IngestionEventInput {
  source: string;
  resourceType: string;
  resourceId?: string;
  status: IngestionEventStatus;
  payload: unknown;
  errorMessage?: string;
}

export async function recordIngestionEvent(
  supabase: DB,
  input: IngestionEventInput
) {
  const { error } = await supabase.from("ingestion_events").insert({
    source: input.source,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    status: input.status,
    error_message: input.errorMessage ?? null,
    payload: input.payload,
  });

  if (error) {
    console.error("Failed to log ingestion event", error);
  }
}
