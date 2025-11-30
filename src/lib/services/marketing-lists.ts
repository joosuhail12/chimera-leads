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
  // Behavioral filters
  lastOpenedAt?: string; // "after" date
  lastClickedAt?: string; // "after" date
  minOpenCount?: number;
  minClickCount?: number;
};

export type CustomFieldFilter = {
  definitionId: string;
  fieldType:
    | "text"
    | "long_text"
    | "number"
    | "boolean"
    | "date"
    | "select"
    | "multiselect"
    | "url"
    | "email"
    | "phone";
  operator: "equals" | "contains" | "includes" | "gte" | "lte";
  value: string;
  fieldLabel?: string;
};

type Supabase = SupabaseClient;

function buildAudienceQuery(
  filters: MarketingListFilter = {},
  supabase: Supabase
) {
  let query = supabase
    .from("audience")
    .select("id, email")
    .order("created_at", { ascending: false });

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

  if (!filters.includeInactive) {
    query = query.eq("is_active", true); // Assuming 'is_active' boolean column
  }

  if (filters.createdAfter) {
    query = query.gte("created_at", filters.createdAfter);
  }

  if (filters.createdBefore) {
    query = query.lte("created_at", filters.createdBefore);
  }

  return query;
}

async function filterByBehavior(
  candidateEmails: string[],
  filters: MarketingListFilter,
  supabase: Supabase
): Promise<Set<string>> {
  if (
    !filters.minOpenCount &&
    !filters.minClickCount &&
    !filters.lastOpenedAt &&
    !filters.lastClickedAt
  ) {
    return new Set(candidateEmails);
  }

  if (!candidateEmails.length) return new Set();

  let eventQuery = supabase.from("email_events").select("recipient, event_type, created_at");

  // Apply time constraints at the query level if possible to reduce data
  // However, since we might need counts, we generally need all relevant events.
  // If we only care about "last opened after X", we can filter events created after X.
  // But if we also need "min open count", we need all opens.
  // So we'll fetch all relevant events for these users and aggregate in memory
  // (assuming the candidate list isn't massive for this demo context).

  // To be safer with large datasets, let's filter by event types we care about
  const eventTypes = [];
  if (filters.lastOpenedAt || filters.minOpenCount) eventTypes.push("open");
  if (filters.lastClickedAt || filters.minClickCount) eventTypes.push("click");

  if (eventTypes.length) {
    eventQuery = eventQuery.in("event_type", eventTypes);
  }

  eventQuery = eventQuery.in("recipient", candidateEmails);

  const { data: events, error } = await eventQuery;

  if (error) {
    throw new Error(`Failed to fetch email events: ${error.message}`);
  }

  const statsByEmail = new Map<
    string,
    {
      opens: number;
      clicks: number;
      lastOpen: string | null;
      lastClick: string | null;
    }
  >();

  // Initialize
  candidateEmails.forEach((email) => {
    statsByEmail.set(email, {
      opens: 0,
      clicks: 0,
      lastOpen: null,
      lastClick: null,
    });
  });

  // Aggregate
  (events ?? []).forEach((event) => {
    const stats = statsByEmail.get(event.recipient);
    if (!stats) return;

    if (event.event_type === "open") {
      stats.opens++;
      if (!stats.lastOpen || event.created_at > stats.lastOpen) {
        stats.lastOpen = event.created_at;
      }
    } else if (event.event_type === "click") {
      stats.clicks++;
      if (!stats.lastClick || event.created_at > stats.lastClick) {
        stats.lastClick = event.created_at;
      }
    }
  });

  // Filter
  return new Set(candidateEmails.filter((email) => {
    const stats = statsByEmail.get(email)!;

    if (filters.minOpenCount && stats.opens < filters.minOpenCount) {
      return false;
    }
    if (filters.minClickCount && stats.clicks < filters.minClickCount) {
      return false;
    }
    if (filters.lastOpenedAt) {
      if (!stats.lastOpen || stats.lastOpen < filters.lastOpenedAt) {
        return false;
      }
    }
    if (filters.lastClickedAt) {
      if (!stats.lastClick || stats.lastClick < filters.lastClickedAt) {
        return false;
      }
    }

    return true;
  }));
}
export function normalizeSlug(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

type AudienceRecord = { id: string; email: string };

type CustomFieldValueRow = {
  entity_id: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
};

const CUSTOM_FIELD_CHUNK_SIZE = 500;

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length <= size) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function matchesCustomFieldValue(
  row: CustomFieldValueRow,
  filter: CustomFieldFilter
) {
  const rawValue = filter.value ?? "";

  switch (filter.fieldType) {
    case "number": {
      const expectedNumber = Number(rawValue);
      if (!Number.isFinite(expectedNumber)) return false;
      const actualNumber =
        typeof row.value_number === "number" ? row.value_number : null;
      if (actualNumber === null) return false;

      if (filter.operator === "equals") {
        return actualNumber === expectedNumber;
      }
      if (filter.operator === "gte") {
        return actualNumber >= expectedNumber;
      }
      if (filter.operator === "lte") {
        return actualNumber <= expectedNumber;
      }
      return false;
    }
    case "boolean": {
      if (filter.operator !== "equals") return false;
      const normalized = rawValue.trim().toLowerCase();
      const expectedBoolean =
        normalized === "true" ||
        normalized === "1" ||
        normalized === "yes" ||
        normalized === "y";
      const actualBoolean =
        typeof row.value_boolean === "boolean"
          ? row.value_boolean
          : row.value_text
          ? row.value_text.trim().toLowerCase() === "true"
          : null;
      if (actualBoolean === null) return false;
      return actualBoolean === expectedBoolean;
    }
    case "date": {
      const actualDate = row.value_date ? Date.parse(row.value_date) : NaN;
      const expectedDate = Date.parse(rawValue);
      if (Number.isNaN(actualDate) || Number.isNaN(expectedDate)) return false;

      if (filter.operator === "equals") {
        return actualDate === expectedDate;
      }
      if (filter.operator === "gte") {
        return actualDate >= expectedDate;
      }
      if (filter.operator === "lte") {
        return actualDate <= expectedDate;
      }
      return false;
    }
    case "multiselect": {
      if (filter.operator !== "includes") return false;
      const expected = rawValue.trim().toLowerCase();
      if (!expected) return false;
      const actualValues = Array.isArray(row.value_json)
        ? row.value_json
        : typeof row.value_json === "string"
        ? row.value_json.split(",").map((value) => value.trim())
        : [];
      return actualValues.some(
        (entry) =>
          typeof entry === "string" && entry.trim().toLowerCase() === expected
      );
    }
    case "text":
    case "long_text":
    case "select":
    case "url":
    case "email":
    case "phone":
    default: {
      const actualText =
        typeof row.value_text === "string" ? row.value_text : null;
      if (!actualText) return false;
      const normalizedActual = actualText.toLowerCase();
      const normalizedExpected = rawValue.toLowerCase();

      if (filter.operator === "equals") {
        return normalizedActual === normalizedExpected;
      }
      if (filter.operator === "contains") {
        return normalizedActual.includes(normalizedExpected);
      }
      return false;
    }
  }
}

async function applyCustomFieldFilters(
  candidates: AudienceRecord[],
  customFilters: CustomFieldFilter[],
  supabase: Supabase
) {
  if (!candidates.length) return candidates;

  let permittedIds = new Set(candidates.map((candidate) => candidate.id));

  for (const customFilter of customFilters) {
    if (!permittedIds.size) break;

    const idsToCheck = Array.from(permittedIds);
    const matchingIds = new Set<string>();

    for (const chunk of chunkArray(idsToCheck, CUSTOM_FIELD_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from("custom_field_values")
        .select(
          "entity_id,value_text,value_number,value_boolean,value_date,value_json"
        )
        .eq("definition_id", customFilter.definitionId)
        .eq("entity_type", "audience")
        .in("entity_id", chunk);

      if (error) {
        throw new Error(
          `Failed to apply custom field filter ${customFilter.fieldLabel ?? customFilter.definitionId
          }: ${error.message}`
        );
      }

      (data ?? []).forEach((row) => {
        if (matchesCustomFieldValue(row as CustomFieldValueRow, customFilter)) {
          matchingIds.add(row.entity_id as string);
        }
      });
    }

    permittedIds = matchingIds;
  }

  return candidates.filter((candidate) => permittedIds.has(candidate.id));
}

async function excludeSuppressedCandidates(
  candidates: AudienceRecord[],
  supabase: Supabase
) {
  if (!candidates.length) return candidates;

  const audienceIds = candidates.map((candidate) => candidate.id);
  const emails = candidates
    .map((candidate) => candidate.email?.toLowerCase())
    .filter(Boolean) as string[];

  const suppressedIds = new Set<string>();
  const suppressedEmails = new Set<string>();

  for (const chunk of chunkArray(audienceIds, 500)) {
    const { data, error } = await supabase
      .from("suppression_entries")
      .select("audience_id")
      .in("audience_id", chunk)
      .not("audience_id", "is", null);
    if (error) {
      throw new Error(`Failed to load suppression entries: ${error.message}`);
    }
    (data ?? []).forEach((row) => {
      if (row.audience_id) {
        suppressedIds.add(row.audience_id as string);
      }
    });
  }

  for (const chunk of chunkArray(emails, 500)) {
    const { data, error } = await supabase
      .from("suppression_entries")
      .select("email")
      .in("email", chunk)
      .not("email", "is", null);
    if (error) {
      throw new Error(`Failed to load suppression emails: ${error.message}`);
    }
    (data ?? []).forEach((row) => {
      if (typeof row.email === "string") {
        suppressedEmails.add(row.email.toLowerCase());
      }
    });
  }

  if (!suppressedIds.size && !suppressedEmails.size) {
    return candidates;
  }

  return candidates.filter(
    (candidate) =>
      !suppressedIds.has(candidate.id) &&
      !suppressedEmails.has(candidate.email.toLowerCase())
  );
}

async function getFilteredAudienceCandidates(
  filters: MarketingListFilter = {},
  supabase: Supabase
) {
  const { data, error } = await buildAudienceQuery(filters, supabase);
  if (error) {
    throw new Error(`Failed to fetch audience for marketing list: ${error.message}`);
  }

  let candidates = (data ?? []) as AudienceRecord[];
  if (!candidates.length) {
    return [];
  }

  if (filters.customFieldFilters?.length) {
    candidates = await applyCustomFieldFilters(
      candidates,
      filters.customFieldFilters,
      supabase
    );
  }

  if (!candidates.length) {
    return [];
  }

  candidates = await excludeSuppressedCandidates(candidates, supabase);

  if (!candidates.length) {
    return [];
  }

  const behaviorMatches = await filterByBehavior(
    candidates.map((candidate) => candidate.email),
    filters,
    supabase
  );

  return candidates.filter((candidate) => behaviorMatches.has(candidate.email));
}

export async function previewMarketingListCount(
  filters: MarketingListFilter = {},
  supabase: Supabase = createAdminClient()
) {
  const candidates = await getFilteredAudienceCandidates(filters, supabase);
  return candidates.length;
}

export async function syncMarketingListMembers(
  listId: string,
  filters: MarketingListFilter = {},
  supabase: Supabase = createAdminClient()
) {
  const candidates = await getFilteredAudienceCandidates(filters, supabase);

  const { error: deleteError } = await supabase
    .from("marketing_list_members")
    .delete()
    .eq("list_id", listId);

  if (deleteError) {
    throw new Error(`Failed to clear marketing list members: ${deleteError.message}`);
  }

  if (candidates.length) {
    const payload = candidates.map((candidate) => ({
      list_id: listId,
      audience_id: candidate.id,
    }));

    const { error: upsertError } = await supabase
      .from("marketing_list_members")
      .upsert(payload, { onConflict: "list_id,audience_id" });

    if (upsertError) {
      throw new Error(`Failed to upsert marketing list members: ${upsertError.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from("marketing_lists")
    .update({ last_refreshed_at: new Date().toISOString() })
    .eq("id", listId);

  if (updateError) {
    throw new Error(`Failed to update marketing list metadata: ${updateError.message}`);
  }

  return { memberCount: candidates.length };
}
