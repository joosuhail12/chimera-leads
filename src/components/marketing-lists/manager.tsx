"use client";

import type { FormEvent, KeyboardEvent } from "react";
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
  // Behavioral
  lastOpenedAt?: string;
  lastClickedAt?: string;
  minOpenCount?: number;
  minClickCount?: number;
};

type CustomFieldType =
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

type CreateListFormState = {
  name: string;
  description: string;
  minScore: string;
  tagMatchMode: "any" | "all";
  emailContains: string;
  includeInactive: boolean;
  createdAfter: string;
  createdBefore: string;
  minOpenCount: string;
  minClickCount: string;
  lastOpenedAt: string;
  lastClickedAt: string;
};

type FormErrors = Partial<
  Record<
    | "minScore"
    | "minOpenCount"
    | "minClickCount"
    | "createdBefore"
    | "lastOpenedAt"
    | "lastClickedAt",
    string
  >
>;

type FilterPreset = {
  id: string;
  name: string;
  createdAt: string;
  filters: MarketingListFilter;
};

const PRESETS_STORAGE_KEY = "marketing-list-presets";

type ChipInputProps = {
  label: string;
  placeholder?: string;
  value: string[];
  suggestions?: string[];
  error?: string | null;
  onChange: (next: string[]) => void;
};

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

function ChipInput({
  label,
  placeholder,
  value,
  suggestions = [],
  error,
  onChange,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState("");

  const filteredSuggestions = useMemo(() => {
    const unused = suggestions.filter(
      (suggestion) =>
        !value.some(
          (existing) => existing.toLowerCase() === suggestion.toLowerCase()
        )
    );
    if (!inputValue.trim()) {
      return unused.slice(0, 5);
    }
    return unused
      .filter((suggestion) =>
        suggestion.toLowerCase().includes(inputValue.trim().toLowerCase())
      )
      .slice(0, 5);
  }, [suggestions, inputValue, value]);

  const addChip = (chip: string) => {
    const normalized = chip.trim();
    if (!normalized) return;
    const alreadyExists = value.some(
      (existing) => existing.toLowerCase() === normalized.toLowerCase()
    );
    if (alreadyExists) {
      setInputValue("");
      return;
    }
    onChange([...value, normalized]);
    setInputValue("");
  };

  const removeChip = (chip: string) => {
    onChange(value.filter((existing) => existing !== chip));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      (event.key === "Enter" || event.key === "," || event.key === "Tab") &&
      inputValue.trim()
    ) {
      event.preventDefault();
      addChip(inputValue);
      return;
    }

    if (event.key === "Backspace" && !inputValue && value.length) {
      onChange(value.slice(0, value.length - 1));
    }
  };

  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <div
        className={`rounded-lg border px-3 py-2 focus-within:border-sky-500 ${error ? "border-red-300 focus-within:border-red-400" : "border-slate-200"
          }`}
      >
        <div className="flex flex-wrap gap-2">
          {value.map((chip) => (
            <span
              key={chip}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="text-slate-400 hover:text-red-500"
                aria-label={`Remove ${chip}`}
              >
                ✕
              </button>
            </span>
          ))}
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder={value.length ? "Add another..." : placeholder}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredSuggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => addChip(suggestion)}
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-sky-200 hover:text-sky-600"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

export function MarketingListsManager() {
  const [lists, setLists] = useState<MarketingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<CreateListFormState>({
    name: "",
    description: "",
    minScore: "",
    tagMatchMode: "any",
    emailContains: "",
    includeInactive: false,
    createdAfter: "",
    createdBefore: "",
    minOpenCount: "",
    minClickCount: "",
    lastOpenedAt: "",
    lastClickedAt: "",
  });
  const [sourceValues, setSourceValues] = useState<string[]>([]);
  const [tagValues, setTagValues] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [customFieldFilters, setCustomFieldFilters] = useState<CustomFieldFilterInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const hasCustomFields = customFields.length > 0;
  const hasCustomFieldFilters = customFieldFilters.length > 0;

  const persistPresets = (next: FilterPreset[]) => {
    setFilterPresets(next);
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(next));
    } catch (err) {
      console.error("Failed to persist filter presets:", err);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FilterPreset[];
        if (Array.isArray(parsed)) {
          setFilterPresets(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load filter presets:", err);
    }
  }, []);

  useEffect(() => {
    const errors: FormErrors = {};
    if (formState.minScore) {
      const value = Number(formState.minScore);
      if (Number.isNaN(value) || value < 0 || value > 100) {
        errors.minScore = "Score must be between 0 and 100.";
      }
    }

    if (formState.minOpenCount) {
      const value = Number(formState.minOpenCount);
      if (Number.isNaN(value) || value < 0) {
        errors.minOpenCount = "Opens must be zero or a positive number.";
      }
    }

    if (formState.minClickCount) {
      const value = Number(formState.minClickCount);
      if (Number.isNaN(value) || value < 0) {
        errors.minClickCount = "Clicks must be zero or a positive number.";
      }
    }

    if (formState.createdAfter && formState.createdBefore) {
      if (new Date(formState.createdAfter) > new Date(formState.createdBefore)) {
        errors.createdBefore = "End date must be after the start date.";
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (formState.lastOpenedAt) {
      if (new Date(formState.lastOpenedAt) > today) {
        errors.lastOpenedAt = "Date cannot be in the future.";
      }
    }
    if (formState.lastClickedAt) {
      if (new Date(formState.lastClickedAt) > today) {
        errors.lastClickedAt = "Date cannot be in the future.";
      }
    }

    setFormErrors(errors);
  }, [formState]);

  // Debounce preview calculation
  useEffect(() => {
    if (!isCreatePanelOpen) return;

    const timer = setTimeout(async () => {
      setIsPreviewLoading(true);
      try {
        const currentFilters: MarketingListFilter = {
          sources: sourceValues.length ? sourceValues : undefined,
          tags: tagValues.length ? tagValues : undefined,
          tagMatchMode: formState.tagMatchMode,
          minCustomerFitScore: formState.minScore
            ? Number(formState.minScore)
            : undefined,
          emailContains: formState.emailContains || undefined,
          includeInactive: formState.includeInactive || undefined,
          createdAfter: formState.createdAfter || undefined,
          createdBefore: formState.createdBefore || undefined,
          minOpenCount: formState.minOpenCount ? Number(formState.minOpenCount) : undefined,
          minClickCount: formState.minClickCount ? Number(formState.minClickCount) : undefined,
          lastOpenedAt: formState.lastOpenedAt || undefined,
          lastClickedAt: formState.lastClickedAt || undefined,
          customFieldFilters: customFieldFilters.length
            ? customFieldFilters.filter((filter) => filter.value.trim())
            : undefined,
        };

        const response = await fetch("/api/marketing-lists/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: currentFilters }),
        });

        if (response.ok) {
          const data = await response.json();
          setPreviewCount(data.count);
        }
      } catch (err) {
        console.error("Preview error:", err);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [
    formState,
    customFieldFilters,
    isCreatePanelOpen,
    sourceValues,
    tagValues,
  ]);

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
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
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
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
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
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
        />
      );
    }

    return (
      <input
        value={filter.value}
        onChange={(event) =>
          handleUpdateCustomFieldFilter(index, { value: event.target.value })
        }
        className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
        placeholder="Enter value"
      />
    );
  };

  const sourceSuggestions = useMemo(() => {
    const values = new Set<string>();
    lists.forEach((list) =>
      list.filters.sources?.forEach((source) => values.add(source))
    );
    return Array.from(values).sort();
  }, [lists]);

  const tagSuggestions = useMemo(() => {
    const values = new Set<string>();
    lists.forEach((list) =>
      list.filters.tags?.forEach((tag) => values.add(tag))
    );
    return Array.from(values).sort();
  }, [lists]);

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
          const body = await response.json().catch(() => ({}));
          console.error("Custom fields API error:", body);
          throw new Error(body.error || "Failed to load custom fields.");
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
    sources: sourceValues.length ? sourceValues : undefined,
    tags: tagValues.length ? tagValues : undefined,
    tagMatchMode: formState.tagMatchMode,
    minCustomerFitScore: formState.minScore
      ? Number(formState.minScore)
      : undefined,
    emailContains: formState.emailContains || undefined,
    includeInactive: formState.includeInactive || undefined,
    createdAfter: formState.createdAfter || undefined,
    createdBefore: formState.createdBefore || undefined,
    minOpenCount: formState.minOpenCount ? Number(formState.minOpenCount) : undefined,
    minClickCount: formState.minClickCount ? Number(formState.minClickCount) : undefined,
    lastOpenedAt: formState.lastOpenedAt || undefined,
    lastClickedAt: formState.lastClickedAt || undefined,
    customFieldFilters: customFieldFilters.length
      ? customFieldFilters.filter((filter) => filter.value.trim())
      : undefined,
  };

  const hasErrors = Object.keys(formErrors).length > 0;

  const savePreset = () => {
    if (!presetName.trim() || hasErrors) return;
    const filtersCopy: MarketingListFilter = {
      ...filters,
      sources: filters.sources ? [...filters.sources] : undefined,
      tags: filters.tags ? [...filters.tags] : undefined,
      customFieldFilters: filters.customFieldFilters
        ? filters.customFieldFilters.map((filter) => ({ ...filter }))
        : undefined,
    };
    const newPreset: FilterPreset = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      name: presetName.trim(),
      createdAt: new Date().toISOString(),
      filters: filtersCopy,
    };
    const nextPresets = [newPreset, ...filterPresets].slice(0, 10);
    persistPresets(nextPresets);
    setPresetName("");
  };

  const applyPreset = (preset: FilterPreset) => {
    const payload = preset.filters;
    setSourceValues(payload.sources ?? []);
    setTagValues(payload.tags ?? []);
    setFormState((state) => ({
      ...state,
      minScore: payload.minCustomerFitScore?.toString() ?? "",
      tagMatchMode: payload.tagMatchMode ?? "any",
      emailContains: payload.emailContains ?? "",
      includeInactive: Boolean(payload.includeInactive),
      createdAfter: payload.createdAfter ?? "",
      createdBefore: payload.createdBefore ?? "",
      minOpenCount: payload.minOpenCount?.toString() ?? "",
      minClickCount: payload.minClickCount?.toString() ?? "",
      lastOpenedAt: payload.lastOpenedAt ?? "",
      lastClickedAt: payload.lastClickedAt ?? "",
    }));
    setCustomFieldFilters(
      payload.customFieldFilters?.map((filter) => ({
        definitionId: filter.definitionId,
        fieldType: filter.fieldType,
        operator: filter.operator,
        value: filter.value,
        fieldLabel: filter.fieldLabel,
      })) ?? []
    );
  };

  const deletePreset = (presetId: string) => {
    const nextPresets = filterPresets.filter((preset) => preset.id !== presetId);
    persistPresets(nextPresets);
  };

  async function handleCreateList(event: FormEvent<HTMLFormElement>) {
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
        minScore: "",
        tagMatchMode: "any",
        emailContains: "",
        includeInactive: false,
        createdAfter: "",
        createdBefore: "",
        minOpenCount: "",
        minClickCount: "",
        lastOpenedAt: "",
        lastClickedAt: "",
      });
      setSourceValues([]);
      setTagValues([]);
      setCustomFieldFilters([]);
      setIsCreatePanelOpen(false);
      setPreviewCount(null);
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
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketing Lists</h1>
          <p className="text-sm text-slate-500">Manage your audience segments and filters.</p>
        </div>
        <button
          onClick={() => setIsCreatePanelOpen(true)}
          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
        >
          Create New List
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Slide-over Panel */}
      {isCreatePanelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCreatePanelOpen(false)}
          />

          {/* Panel */}
          <div className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl transition-transform">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">New Marketing List</h2>
              <button
                onClick={() => setIsCreatePanelOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <span className="sr-only">Close</span>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateList} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4 rounded-xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">List Details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    List Name
                    <input
                      required
                      value={formState.name}
                      onChange={(e) => setFormState(s => ({ ...s, name: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none"
                      placeholder="e.g. High Value Leads"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Description
                    <input
                      value={formState.description}
                      onChange={(e) => setFormState(s => ({ ...s, description: e.target.value }))}
                      className="rounded-lg border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none"
                      placeholder="Optional description"
                    />
                  </label>
                </div>
              </div>

              {/* Filters */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900">Audience Filters</h3>

                <div className="grid gap-4 md:grid-cols-2">
                  <ChipInput
                    label="Sources"
                    placeholder="Type a source and press Enter"
                    value={sourceValues}
                    suggestions={sourceSuggestions}
                    onChange={setSourceValues}
                  />
                  <ChipInput
                    label="Tags"
                    placeholder="Type a tag and press Enter"
                    value={tagValues}
                    suggestions={tagSuggestions}
                    onChange={setTagValues}
                  />
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Min. Fit Score
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formState.minScore}
                      onChange={(e) => setFormState(s => ({ ...s, minScore: e.target.value }))}
                      className={`rounded-lg border px-3 py-2 focus:outline-none ${formErrors.minScore ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-sky-500"
                        }`}
                    />
                    {formErrors.minScore && (
                      <span className="text-xs text-red-600">{formErrors.minScore}</span>
                    )}
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                    Tag Match
                    <select
                      value={formState.tagMatchMode}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          tagMatchMode: e.target.value as CreateListFormState["tagMatchMode"],
                        }))
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none"
                    >
                      <option value="any">Match Any</option>
                      <option value="all">Match All</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-100 bg-white/60 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Saved Presets
                      </h4>
                      <p className="text-xs text-slate-500">
                        Capture filter combos you reuse often.
                      </p>
                    </div>
                    <div className="flex w-full gap-2 md:w-auto">
                      <input
                        value={presetName}
                        onChange={(event) => setPresetName(event.target.value)}
                        placeholder="Name this preset"
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={savePreset}
                        disabled={!presetName.trim() || hasErrors}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  {filterPresets.length > 0 ? (
                    <ul className="space-y-2">
                      {filterPresets.map((preset) => (
                        <li
                          key={preset.id}
                          className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{preset.name}</p>
                            <p className="text-xs text-slate-500">
                              Saved {new Date(preset.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => applyPreset(preset)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-600"
                            >
                              Apply
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePreset(preset.id)}
                              className="rounded-lg border border-transparent px-3 py-1.5 text-xs text-slate-400 transition hover:border-red-200 hover:text-red-500"
                              aria-label={`Delete preset ${preset.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Saved presets will appear here for quick reuse.
                    </p>
                  )}
                </div>

                {/* Behavioral Filters */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Engagement</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      Min. Opens
                      <input
                        type="number"
                        min="0"
                        value={formState.minOpenCount}
                        onChange={(e) => setFormState(s => ({ ...s, minOpenCount: e.target.value }))}
                        className={`rounded-lg border px-3 py-2 focus:outline-none ${formErrors.minOpenCount ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-sky-500"
                          }`}
                      />
                      {formErrors.minOpenCount && (
                        <span className="text-xs text-red-600">{formErrors.minOpenCount}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      Min. Clicks
                      <input
                        type="number"
                        min="0"
                        value={formState.minClickCount}
                        onChange={(e) => setFormState(s => ({ ...s, minClickCount: e.target.value }))}
                        className={`rounded-lg border px-3 py-2 focus:outline-none ${formErrors.minClickCount ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-sky-500"
                          }`}
                      />
                      {formErrors.minClickCount && (
                        <span className="text-xs text-red-600">{formErrors.minClickCount}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      Last Opened After
                      <input
                        type="date"
                        value={formState.lastOpenedAt}
                        onChange={(e) => setFormState(s => ({ ...s, lastOpenedAt: e.target.value }))}
                        className={`rounded-lg border px-3 py-2 focus:outline-none ${formErrors.lastOpenedAt ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-sky-500"
                          }`}
                      />
                      {formErrors.lastOpenedAt && (
                        <span className="text-xs text-red-600">{formErrors.lastOpenedAt}</span>
                      )}
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                      Last Clicked After
                      <input
                        type="date"
                        value={formState.lastClickedAt}
                        onChange={(e) => setFormState(s => ({ ...s, lastClickedAt: e.target.value }))}
                        className={`rounded-lg border px-3 py-2 focus:outline-none ${formErrors.lastClickedAt ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-sky-500"
                          }`}
                      />
                      {formErrors.lastClickedAt && (
                        <span className="text-xs text-red-600">{formErrors.lastClickedAt}</span>
                      )}
                    </label>
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custom Fields</h4>
                    <button
                      type="button"
                      onClick={handleAddCustomFieldFilter}
                      disabled={!hasCustomFields}
                      title={
                        hasCustomFields
                          ? undefined
                          : "Create at least one audience custom field to add conditions."
                      }
                      className="text-xs font-semibold text-sky-600 hover:text-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      + Add Condition
                    </button>
                  </div>

                  {!hasCustomFieldFilters ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-xs text-slate-500">
                      {hasCustomFields ? (
                        <p>Add your first custom field condition to narrow the audience.</p>
                      ) : (
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <p>No audience custom fields are available yet.</p>
                          <a
                            href="/dashboard/custom-fields"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-200 hover:text-sky-600"
                          >
                            Manage Custom Fields
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    customFieldFilters.map((filter, index) => (
                      <div key={index} className="flex flex-wrap gap-2 md:flex-nowrap">
                        <select
                          value={filter.definitionId}
                          onChange={(e) => {
                            const field = customFields.find(f => f.id === e.target.value);
                            if (field) {
                              const operatorOptions = getOperatorOptions(field.field_type);
                              handleUpdateCustomFieldFilter(index, {
                                definitionId: field.id,
                                fieldType: field.field_type,
                                fieldLabel: field.name,
                                operator: (operatorOptions as readonly string[]).includes(filter.operator)
                                  ? filter.operator
                                  : operatorOptions[0],
                                value: getDefaultValueForFieldType(field.field_type)
                              });
                            }
                          }}
                          className="min-w-[140px] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        >
                          {customFields.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <select
                          value={filter.operator}
                          onChange={(e) => handleUpdateCustomFieldFilter(index, { operator: e.target.value as CustomFieldFilterInput["operator"] })}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        >
                          {getOperatorOptions(filter.fieldType).map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                        <div className="flex-1 min-w-[140px]">
                          {renderCustomFilterValueInput(filter, index)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomFieldFilter(index)}
                          className="text-slate-400 hover:text-red-500"
                          aria-label="Remove condition"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer / Actions */}
              <div className="sticky bottom-0 -mx-6 -mb-6 border-t border-slate-100 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    {isPreviewLoading ? (
                      <span className="text-slate-400">Calculating...</span>
                    ) : (
                      <span className="font-medium text-slate-900">
                        {previewCount !== null ? `${previewCount} matching contacts` : "Ready to calculate"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatePanelOpen(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formState.name.trim() || hasErrors}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-50"
                    >
                      {isSubmitting ? "Creating..." : "Create List"}
                    </button>
                  </div>
                  {hasErrors && (
                    <p className="mt-2 text-xs text-red-600">
                      Fix the highlighted fields to save this segment.
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Lists Grid */}
      <section className="space-y-4">
        {loading && !lists.length ? (
          <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            <p className="text-sm text-slate-500">Loading lists...</p>
          </div>
        ) : activeLists.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeLists.map((list) => (
              <article
                key={list.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{list.name}</h3>
                      <p className="text-xs text-slate-500">{list.member_count} members</p>
                    </div>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => refreshMembers(list.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-600"
                        title="Refresh"
                      >
                        ↻
                      </button>
                      <button
                        onClick={() => toggleArchive(list, true)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        title="Archive"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {list.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">{list.description}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {list.filters.sources?.map(s => (
                      <span key={s} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {s}
                      </span>
                    ))}
                    {list.filters.minCustomerFitScore && (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        {list.filters.minCustomerFitScore}+ Score
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <a
                    href={`/dashboard/marketing-lists/${list.id}`}
                    className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 transition hover:border-sky-200 hover:text-sky-600"
                  >
                    View Details
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <div className="rounded-full bg-white p-4 shadow-sm">
              <span className="text-2xl">📋</span>
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">No lists yet</h3>
            <p className="mt-1 text-sm text-slate-500">Create your first segment to get started.</p>
            <button
              onClick={() => setIsCreatePanelOpen(true)}
              className="mt-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Create List
            </button>
          </div>
        )}
      </section>

      {/* Archived Lists Section */}
      {archivedLists.length > 0 && (
        <section className="mt-8 border-t border-slate-200 pt-8">
          <h2 className="mb-4 text-sm font-semibold text-slate-500">Archived Lists</h2>
          <div className="grid gap-4 md:grid-cols-3 opacity-75">
            {archivedLists.map((list) => (
              <div key={list.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{list.name}</span>
                  <button
                    onClick={() => toggleArchive(list, false)}
                    className="text-xs font-medium text-sky-600 hover:text-sky-500"
                  >
                    Restore
                  </button>
                </div>
                <p className="text-xs text-slate-500">{list.member_count} members</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
