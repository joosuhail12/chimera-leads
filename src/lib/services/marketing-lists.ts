import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingListFilter = {
  sources?: string[];
  tags?: string[];
  tagMatchMode?: "any" | "all";
  minCustomerFitScore?: number;
  emailContains?: string;
  includeInactive?: boolean;
};

type Supabase = SupabaseClient;

export async function syncMarketingListMembers(
  listId: string,
  filters: MarketingListFilter,
  supabase: Supabase = createAdminClient()
) {
  let query = supabase
    .from("audience")
    .select("id")
    .order("created_at", { ascending: false });

  if (!filters.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (filters.sources?.length) {
    query = query.in("source", filters.sources);
  }

  if (filters.tags?.length) {
    if ((filters.tagMatchMode ?? "any") === "all") {
      query = query.contains("tags", filters.tags);
    } else {
      query = query.overlaps("tags", filters.tags);
    }
  }

  if (
    typeof filters.minCustomerFitScore === "number" &&
    Number.isFinite(filters.minCustomerFitScore)
  ) {
    query = query.gte(
      "customer_fit_score",
      filters.minCustomerFitScore as number
    );
  }

  if (filters.emailContains) {
    query = query.ilike("email", `%${filters.emailContains}%`);
  }

  const { data: audienceRows, error: audienceError } = await query;

  if (audienceError) {
    throw new Error(`Failed to select audience rows: ${audienceError.message}`);
  }

  const audienceIds = (audienceRows ?? []).map((row) => row.id);

  const { error: deleteError } = await supabase
    .from("marketing_list_members")
    .delete()
    .eq("list_id", listId);

  if (deleteError) {
    throw new Error(`Failed to clear list members: ${deleteError.message}`);
  }

  if (audienceIds.length) {
    const rows = audienceIds.map((audienceId) => ({
      list_id: listId,
      audience_id: audienceId,
    }));

    const { error: insertError } = await supabase
      .from("marketing_list_members")
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to insert list members: ${insertError.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from("marketing_lists")
    .update({
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("id", listId);

  if (updateError) {
    throw new Error(
      `Failed to update marketing list metadata: ${updateError.message}`
    );
  }

  return {
    memberCount: audienceIds.length,
  };
}

export function normalizeSlug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
