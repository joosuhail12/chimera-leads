import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketingListFilter = {
  sources?: string[];
  tags?: string[];
  tagMatchMode?: "any" | "all";
  minCustomerFitScore?: number;
  emailContains?: string;
  includeInactive?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  customFieldFilters?: CustomFieldFilter[];
};

export type CustomFieldFilter = {
  definitionId: string;
  fieldType: "text" | "number" | "boolean" | "date" | "select" | "multiselect";
  operator: "equals" | "contains" | "includes" | "gte" | "lte";
  value: string;
  fieldLabel?: string;
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

  if (filters.createdAfter) {
    query = query.gte("created_at", filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lte("created_at", filters.createdBefore);
  }

  const { data: audienceRows, error: audienceError } = await query;

  if (audienceError) {
    throw new Error(`Failed to select audience rows: ${audienceError.message}`);
  }

  let audienceIds = (audienceRows ?? []).map((row) => row.id);

  if (audienceIds.length && filters.customFieldFilters?.length) {
    audienceIds = await filterAudienceByCustomFields(
      audienceIds,
      filters.customFieldFilters,
      supabase
    );
  }

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

async function filterAudienceByCustomFields(
  initialIds: string[],
  customFilters: CustomFieldFilter[],
  supabase: Supabase
) {
  let matchingIds = initialIds;

  for (const filter of customFilters) {
    if (!matchingIds.length) {
      break;
    }

    const { data, error } = await supabase
      .from("custom_field_values")
      .select<CustomFieldValueRow>(
        "entity_id,value_text,value_number,value_boolean,value_date,value_json"
      )
      .eq("entity_type", "audience")
      .eq("definition_id", filter.definitionId)
      .in("entity_id", matchingIds);

    if (error) {
      throw new Error(
        `Failed to evaluate custom field filters: ${error.message}`
      );
    }

    const satisfied = new Set<string>();

    for (const row of data ?? []) {
      if (matchesCustomFilter(row, filter)) {
        satisfied.add(row.entity_id);
      }
    }

    matchingIds = matchingIds.filter((id) => satisfied.has(id));
  }

  return matchingIds;
}

type CustomFieldValueRow = {
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
};

function matchesCustomFilter(
  row: CustomFieldValueRow,
  filter: CustomFieldFilter
) {
  const value = filter.value ?? "";
  switch (filter.fieldType) {
    case "number": {
      const target = Number(value);
      if (!Number.isFinite(target)) return false;
      const current = row.value_number;
      if (current === null || current === undefined) return false;
      if (filter.operator === "gte") return current >= target;
      if (filter.operator === "lte") return current <= target;
      return current === target;
    }
    case "boolean": {
      const target = value === "true" || value === "1";
      return row.value_boolean === target;
    }
    case "date": {
      const rowValue = row.value_date;
      if (!rowValue) return false;
      if (filter.operator === "gte") {
        return rowValue >= value;
      }
      if (filter.operator === "lte") {
        return rowValue <= value;
      }
      return rowValue === value;
    }
    case "select": {
      const current = row.value_text?.toLowerCase() ?? "";
      const target = value.toLowerCase();
      if (filter.operator === "contains") {
        return current.includes(target);
      }
      return current === target;
    }
    case "multiselect": {
      if (!row.value_json || !Array.isArray(row.value_json)) {
        return false;
      }
      const list = (row.value_json as unknown[]).map((item) =>
        String(item).toLowerCase()
      );
      return list.includes(value.toLowerCase());
    }
    default: {
      const current = row.value_text?.toLowerCase() ?? "";
      const target = value.toLowerCase();
      if (filter.operator === "contains") {
        return current.includes(target);
      }
      return current === target;
    }
  }
}
