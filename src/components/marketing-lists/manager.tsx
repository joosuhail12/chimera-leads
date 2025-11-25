"use client";

import { useEffect, useMemo, useState } from "react";

type MarketingList = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  filters: MarketingListFilter;
  is_archived: boolean;
  last_refreshed_at?: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
};

type MarketingListFilter = {
  sources?: string[];
  tags?: string[];
  tagMatchMode?: "any" | "all";
  minCustomerFitScore?: number;
  includeInactive?: boolean;
  emailContains?: string;
  createdAfter?: string;
  createdBefore?: string;
  customFieldFilters?: CustomFieldFilterInput[];
};

type CustomFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiselect";

type CustomFieldFilterInput = {
  definitionId: string;
  fieldType: CustomFieldType;
  operator: "equals" | "contains" | "includes" | "gte" | "lte";
  value: string;
  fieldLabel?: string;
};

type CustomFieldDefinition = {
  id: string;
  name: string;
  field_key: string;
  description?: string | null;
  field_type: CustomFieldType;
  entity_type: "sales_leads" | "audience" | "startup_applications";
};

const toCsv = (values?: string[]) => values?.join(", ") ?? "";

const getOperatorOptions = (fieldType: CustomFieldType) => {
  switch (fieldType) {
    case "number":
    case "date":
      return ["equals", "gte", "lte"] as const;
    case "boolean":
      return ["equals"] as const;
    case "multiselect":
      return ["includes"] as const;
    default:
      return ["equals", "contains"] as const;
  }
};

const getDefaultValueForFieldType = (fieldType: CustomFieldType) => {
  if (fieldType === "boolean") {
    return "true";
  }
  return "";
};

export function MarketingListsManager() {
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    sources: "",
    tags: "",
    minScore: "",
    tagMatchMode: "any",
    emailContains: "",
    includeInactive: false,
    createdAfter: "",
    createdBefore: "",
  });
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddCustomFieldFilter = () => {
    if (!customFields.length) {
      return;
    }
    const field = customFields[0];
    const operatorOptions = getOperatorOptions(field.field_type);
    setCustomFieldFilters((prev) => [
      ...prev,
      {
        definitionId: field.id,
        fieldType: field.field_type,
        operator: operatorOptions[0],
        value: getDefaultValueForFieldType(field.field_type),
        fieldLabel: field.name,
      },
    ]);
  };

  const handleUpdateCustomFieldFilter = (
    index: number,
    updates: Partial<CustomFieldFilterInput>
  ) => {
    setCustomFieldFilters((prev) =>
      prev.map((filter, idx) => (idx === index ? { ...filter, ...updates } : filter))
    );
  };

  const handleRemoveCustomFieldFilter = (index: number) => {
    setCustomFieldFilters((prev) => prev.filter((_, idx) => idx !== index));
  };

  const renderCustomFilterValueInput = (
    filter: CustomFieldFilterInput,
    index: number
  ) => {
    if (filter.fieldType === "number") {
      return (
        <input
          type="number"
          value={filter.value}
          onChange={(event) =>
            handleUpdateCustomFieldFilter(index, { value: event.target.value })
          }
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
          placeholder="e.g. 75"
        />
      );
    }

    if (filter.fieldType === "boolean") {
      return (
        <select
          value={filter.value}
          onChange={(event) =>
            handleUpdateCustomFieldFilter(index, { value: event.target.value })
          }
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      );
    }

    if (filter.fieldType === "date") {
      return (
        <input
          type="date"
          value={filter.value}
          onChange={(event) =>
            handleUpdateCustomFieldFilter(index, { value: event.target.value })
          }
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
        />
      );
    }

    return (
      <input
        value={filter.value}
        onChange={(event) =>
          handleUpdateCustomFieldFilter(index, { value: event.target.value })
        }
        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
        placeholder="Enter value"
      />
    );
  };

  const activeLists = useMemo(
    () => lists.filter((list) => !list.is_archived),
    [lists]
  );
  const archivedLists = useMemo(
    () => lists.filter((list) => list.is_archived),
    [lists]
  );

  async function loadLists() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing-lists", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load marketing lists.");
      }
      const data = (await response.json()) as { lists: MarketingList[] };
      setLists(data.lists ?? []);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to load marketing lists."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    async function loadCustomFields() {
      try {
        const response = await fetch(
          "/api/custom-fields?entityType=audience",
          { cache: "no-store" }
        );
        if (!response.ok) {
          throw new Error("Failed to load custom fields.");
        }
        const payload = (await response.json()) as {
          definitions: CustomFieldDefinition[];
        };
        setCustomFields(payload.definitions ?? []);
      } catch (err) {
        console.error(err);
      }
    }

    loadCustomFields();
  }, []);

  const filters: MarketingListFilter = {
    sources: formState.sources
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    tags: formState.tags
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    tagMatchMode: formState.tagMatchMode as "any" | "all",
    minCustomerFitScore: formState.minScore
      ? Number(formState.minScore)
      : undefined,
    emailContains: formState.emailContains || undefined,
    includeInactive: formState.includeInactive || undefined,
    createdAfter: formState.createdAfter || undefined,
    createdBefore: formState.createdBefore || undefined,
    customFieldFilters: customFieldFilters.length
      ? customFieldFilters.filter((filter) => filter.value.trim())
      : undefined,
  };

  async function handleCreateList(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name,
          description: formState.description || undefined,
          filters,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Failed to create marketing list.");
      }
      setFormState({
        name: "",
        description: "",
        sources: "",
        tags: "",
        minScore: "",
        tagMatchMode: "any",
        emailContains: "",
        includeInactive: false,
        createdAfter: "",
        createdBefore: "",
      });
      setCustomFieldFilters([]);
      await loadLists();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to create marketing list."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function refreshMembers(listId: string) {
    try {
      await fetch(`/api/marketing-lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshMembers: true }),
      });
      await loadLists();
    } catch {
      setError("Failed to refresh marketing list members.");
    }
  }

  async function toggleArchive(list: MarketingList, archive: boolean) {
    try {
      await fetch(`/api/marketing-lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_archived: archive }),
      });
      await loadLists();
    } catch {
      setError("Failed to update marketing list.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Create a subscriber list
        </h2>
        <p className="text-sm text-slate-500">
          Define filters once. We&apos;ll snapshot the matching audience records
          so you can target campaigns safely.
        </p>

        <form
          onSubmit={handleCreateList}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            List name
            <input
              required
              value={formState.name}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  name: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="e.g. Product qualified leads"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Description
            <input
              value={formState.description}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  description: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="Optional note for teammates"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Sources (CSV)
            <input
              value={formState.sources}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  sources: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="blog, webinar, waitlist"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Tags (CSV)
            <input
              value={formState.tags}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  tags: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="beta, founders, priority"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Email contains
            <input
              value={formState.emailContains}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  emailContains: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="@company.com"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Tag match mode
            <select
              value={formState.tagMatchMode}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  tagMatchMode: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
            >
              <option value="any">Match any tag</option>
              <option value="all">Match every tag</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Min. customer fit score
            <input
              type="number"
              value={formState.minScore}
              min={0}
              max={100}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  minScore: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="e.g. 75"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Created after
            <input
              type="date"
              value={formState.createdAfter}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  createdAfter: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Created before
            <input
              type="date"
              value={formState.createdBefore}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  createdBefore: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
            />
          </label>
          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formState.includeInactive}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    includeInactive: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              Include inactive contacts
            </label>
          </div>
          <div className="md:col-span-2 space-y-3 rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Custom field filters
              </p>
              <button
                type="button"
                onClick={handleAddCustomFieldFilter}
                disabled={!customFields.length}
                className="text-xs font-semibold text-sky-600 transition hover:text-sky-500 disabled:opacity-50"
              >
                Add condition
              </button>
            </div>
            {customFieldFilters.length === 0 ? (
              <p className="text-xs text-slate-500">
                {customFields.length
                  ? "No custom conditions added yet."
                  : "Define audience custom fields first to filter by them."}
              </p>
            ) : (
              <div className="space-y-3">
                {customFieldFilters.map((filter, index) => {
                  const fieldOptions = customFields;
                  const operators = getOperatorOptions(filter.fieldType);
                  return (
                    <div
                      key={`${filter.definitionId}-${index}`}
                      className="grid gap-2 md:grid-cols-4"
                    >
                      <select
                        value={filter.definitionId}
                        onChange={(event) => {
                          const nextField = fieldOptions.find(
                            (field) => field.id === event.target.value
                          );
                          if (!nextField) {
                            return;
                          }
                          const nextOperators = getOperatorOptions(
                            nextField.field_type
                          );
                          handleUpdateCustomFieldFilter(index, {
                            definitionId: nextField.id,
                            fieldType: nextField.field_type,
                            operator: nextOperators[0],
                            value: getDefaultValueForFieldType(nextField.field_type),
                            fieldLabel: nextField.name,
                          });
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
                      >
                        {fieldOptions.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={filter.operator}
                        onChange={(event) =>
                          handleUpdateCustomFieldFilter(index, {
                            operator: event.target.value as CustomFieldFilterInput["operator"],
                          })
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
                      >
                        {operators.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <div className="md:col-span-2 flex items-center gap-2">
                        <div className="flex-1">
                          {renderCustomFilterValueInput(filter, index)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomFieldFilter(index)}
                          className="rounded-lg border border-transparent px-2 py-1 text-xs font-semibold text-slate-400 transition hover:text-red-500"
                          aria-label="Remove condition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !formState.name.trim()}
              className="rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-lg disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create list"}
            </button>
            {error ? (
              <p className="text-xs text-red-500">{error}</p>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Active lists
          </h2>
          <button
            type="button"
            onClick={loadLists}
            className="text-sm font-semibold text-sky-600 hover:text-sky-500"
          >
            Refresh
          </button>
        </div>

        {loading && !lists.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading marketing lists…
          </div>
        ) : activeLists.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {activeLists.map((list) => {
              const listFilters = (list.filters ?? {}) as MarketingListFilter;
              return (
                <article
                  key={list.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {list.name}
                    </p>
                    <p className="text-xs text-slate-500">{list.slug}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {list.member_count} members
                  </span>
                </div>
                {list.description ? (
                  <p className="mt-2 text-sm text-slate-500">
                    {list.description}
                  </p>
                ) : null}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Sources
                    </dt>
                    <dd>{toCsv(listFilters.sources)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Tags
                    </dt>
                    <dd>{toCsv(listFilters.tags)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Fit score
                    </dt>
                    <dd>
                      {listFilters.minCustomerFitScore
                        ? `${listFilters.minCustomerFitScore}+`
                        : "Any"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Updated
                    </dt>
                    <dd>
                      {list.last_refreshed_at
                        ? new Date(
                            list.last_refreshed_at
                          ).toLocaleDateString()
                        : "Never"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Email filter
                    </dt>
                    <dd>{listFilters.emailContains ?? "Any"}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Created window
                    </dt>
                    <dd>
                      {listFilters.createdAfter || listFilters.createdBefore
                        ? `${listFilters.createdAfter ?? "…"} → ${
                            listFilters.createdBefore ?? "…"
                          }`
                        : "Any time"}
                    </dd>
                  </div>
                </dl>
                {listFilters.customFieldFilters?.length ? (
                  <ul className="mt-3 space-y-1 rounded-xl bg-slate-50/80 p-3 text-xs text-slate-600">
                    {listFilters.customFieldFilters.map((filter, idx) => (
                      <li key={`${filter.definitionId}-${idx}`}>
                        <span className="font-semibold text-slate-900">
                          {filter.fieldLabel ?? filter.definitionId}
                        </span>{" "}
                        {filter.operator} “{filter.value}”
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => refreshMembers(list.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-600"
                  >
                    Rebuild list
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleArchive(list, true)}
                    className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                  >
                    Archive
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No marketing lists yet. Use the form above to create your first
            segment.
          </div>
        )}
      </section>

      {archivedLists.length ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">
              Archived lists
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {archivedLists.map((list) => {
              const listFilters = (list.filters ?? {}) as MarketingListFilter;
              return (
                <article
                  key={list.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500"
                >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{list.name}</p>
                  <span className="text-xs">{list.member_count} members</span>
                </div>
                <p className="mt-1 text-xs">{list.description}</p>
                {listFilters.customFieldFilters?.length ? (
                  <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
                    {listFilters.customFieldFilters.map((filter, idx) => (
                      <li key={`${filter.definitionId}-${idx}`}>
                        {filter.fieldLabel ?? filter.definitionId}: {filter.operator} “
                        {filter.value}”
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleArchive(list, false)}
                  className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                >
                  Restore
                </button>
              </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
