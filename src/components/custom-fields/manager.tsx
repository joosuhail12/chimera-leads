"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type CustomEntityType = "sales_leads" | "audience" | "startup_applications";
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

type CustomFieldDefinition = {
  id: string;
  entity_type: CustomEntityType;
  name: string;
  field_key: string;
  description?: string | null;
  field_type: CustomFieldType;
  options?: string[] | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
};

const entityLabels: Record<CustomEntityType, string> = {
  sales_leads: "Sales leads",
  audience: "Audience",
  startup_applications: "Startup apps",
};

const entityIcons: Record<CustomEntityType, string> = {
  sales_leads: "💼",
  audience: "👥",
  startup_applications: "🚀",
};

const entityOrder = Object.keys(entityLabels) as CustomEntityType[];

const fieldTypeMeta: Record<
  CustomFieldType,
  { label: string; description: string; icon: string }
> = {
  text: { label: "Short text", description: "Single line", icon: "📝" },
  long_text: { label: "Long text", description: "Paragraph", icon: "📄" },
  number: { label: "Number", description: "Numeric value", icon: "🔢" },
  boolean: { label: "Yes / No", description: "Toggle", icon: "✅" },
  date: { label: "Date", description: "Calendar date", icon: "📅" },
  select: { label: "Dropdown", description: "Choose one", icon: "⬇️" },
  multiselect: { label: "Multi-select", description: "Choose many", icon: "🧩" },
  url: { label: "URL", description: "Link", icon: "🌐" },
  email: { label: "Email", description: "Validated email", icon: "✉️" },
  phone: { label: "Phone", description: "Phone number", icon: "📞" },
};

const orderedFieldTypes: CustomFieldType[] = [
  "text",
  "long_text",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "email",
  "phone",
  "url",
];

type FormState = {
  entityType: CustomEntityType;
  name: string;
  fieldKey: string;
  description: string;
  fieldType: CustomFieldType;
  isRequired: boolean;
};

const defaultFormState: FormState = {
  entityType: "sales_leads",
  name: "",
  fieldKey: "",
  description: "",
  fieldType: "text",
  isRequired: false,
};

function slugifyFieldKey(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return "—";
  const target = new Date(dateString).getTime();
  if (Number.isNaN(target)) return "—";
  const diffMs = Date.now() - target;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function CustomFieldsManager() {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectOptions, setSelectOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState("");
  const [activeEntity, setActiveEntity] = useState<CustomEntityType>("sales_leads");
  const [typeFilter, setTypeFilter] = useState<CustomFieldType | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showRequiredOnly, setShowRequiredOnly] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [prefillSource, setPrefillSource] = useState<string | null>(null);
  const [fieldKeyTouched, setFieldKeyTouched] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEntity, setModalEntity] = useState<CustomEntityType>("sales_leads");

  async function loadDefinitions() {
    setLoading(true);
    setListError(null);
    try {
      const response = await fetch("/api/custom-fields", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load custom fields.");
      }
      const payload = (await response.json()) as {
        definitions: CustomFieldDefinition[];
      };
      setDefinitions(payload.definitions ?? []);
    } catch (err) {
      console.error(err);
      setListError(
        err instanceof Error ? err.message : "Failed to load custom fields."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDefinitions();
  }, []);

  const groupedDefinitions = useMemo(() => {
    return definitions.reduce<
      Record<CustomEntityType, CustomFieldDefinition[]>
    >(
      (acc, definition) => {
        acc[definition.entity_type] = [
          ...(acc[definition.entity_type] ?? []),
          definition,
        ];
        return acc;
      },
      {
        sales_leads: [],
        audience: [],
        startup_applications: [],
      }
    );
  }, [definitions]);

  const summaryStats = useMemo(() => {
    const requiredCount = definitions.filter((field) => field.is_required).length;
    const lastUpdated = definitions.reduce<string | null>((latest, field) => {
      if (!latest) return field.updated_at;
      return field.updated_at > latest ? field.updated_at : latest;
    }, null);
    const coverage = entityOrder.filter(
      (entity) => groupedDefinitions[entity]?.length
    ).length;
    return {
      total: definitions.length,
      required: requiredCount,
      lastUpdatedLabel: formatRelativeTime(lastUpdated),
      coverage,
    };
  }, [definitions, groupedDefinitions]);

  const entityDefinitions = useMemo(
    () => groupedDefinitions[activeEntity] ?? [],
    [groupedDefinitions, activeEntity]
  );

  const filteredDefinitions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return entityDefinitions.filter((definition) => {
      if (typeFilter !== "all" && definition.field_type !== typeFilter) {
        return false;
      }
      if (showRequiredOnly && !definition.is_required) {
        return false;
      }
      if (search) {
        const haystack = `${definition.name} ${definition.field_key} ${
          definition.description ?? ""
        }`.toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [entityDefinitions, typeFilter, searchTerm, showRequiredOnly]);

  const schemaPreview = useMemo(() => {
    const subset = entityDefinitions.slice(0, 6).map((field) => ({
      key: field.field_key,
      type: field.field_type,
      required: field.is_required,
    }));
    return subset.length
      ? JSON.stringify(subset, null, 2)
      : "// Fields created here will appear in API payloads";
  }, [entityDefinitions]);

  const filtersApplied =
    typeFilter !== "all" ||
    showRequiredOnly ||
    Boolean(searchTerm.trim());

  const isChoiceField =
    formState.fieldType === "select" || formState.fieldType === "multiselect";

  function resetForm(entity: CustomEntityType = activeEntity) {
    setFormState({
      ...defaultFormState,
      entityType: entity,
    });
    setSelectOptions([]);
    setOptionInput("");
    setFormError(null);
    setPrefillSource(null);
    setFieldKeyTouched(false);
  }

  function handleOptionAdd() {
    const nextValue = optionInput.trim();
    if (!nextValue) return;
    const exists = selectOptions.some(
      (option) => option.toLowerCase() === nextValue.toLowerCase()
    );
    if (exists) {
      setOptionInput("");
      return;
    }
    setSelectOptions((prev) => [...prev, nextValue]);
    setOptionInput("");
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleOptionAdd();
    } else if (
      event.key === "Backspace" &&
      !optionInput &&
      selectOptions.length
    ) {
      setSelectOptions((prev) => prev.slice(0, prev.length - 1));
    }
  }

  function openCreateModal(entity: CustomEntityType) {
    setModalEntity(entity);
    resetForm(entity);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm(modalEntity);
  }

  function handleDuplicate(definition: CustomFieldDefinition) {
    setActiveEntity(definition.entity_type);
    setModalEntity(definition.entity_type);
    setFormState({
      entityType: definition.entity_type,
      name: `${definition.name} Copy`,
      fieldKey: `${definition.field_key}_copy`.slice(0, 60),
      description: definition.description ?? "",
      fieldType: definition.field_type,
      isRequired: definition.is_required,
    });
    if (
      definition.field_type === "select" ||
      definition.field_type === "multiselect"
    ) {
      setSelectOptions([...(definition.options ?? [])]);
    } else {
      setSelectOptions([]);
    }
    setOptionInput("");
    setPrefillSource(definition.name);
    setFieldKeyTouched(true);
    setIsModalOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: formState.entityType,
          name: formState.name,
          fieldKey: formState.fieldKey || undefined,
          description: formState.description || undefined,
          fieldType: formState.fieldType,
          options:
            formState.fieldType === "select" ||
            formState.fieldType === "multiselect"
              ? selectOptions
              : undefined,
          isRequired: formState.isRequired,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create custom field.");
      }

      closeModal();
      await loadDefinitions();
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : "Failed to create custom field."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(definitionId: string, name: string) {
    if (
      !window.confirm(
        `Deleting “${name}” removes values from every record. Continue?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/custom-fields/${definitionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to delete custom field.");
      }
      await loadDefinitions();
    } catch (err) {
      console.error(err);
      setListError(
        err instanceof Error ? err.message : "Failed to delete custom field."
      );
    }
  }

  async function handleCopySchema() {
    if (!definitions.length) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(definitions, null, 2)
      );
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }

  async function handleCopyFieldKey(fieldKey: string) {
    try {
      await navigator.clipboard.writeText(fieldKey);
    } catch (err) {
      console.error(err);
    }
  }

  function clearFilters() {
    setTypeFilter("all");
    setSearchTerm("");
    setShowRequiredOnly(false);
  }

  function handleEntityTabChange(entity: CustomEntityType) {
    if (entity === activeEntity) return;
    setActiveEntity(entity);
    setModalEntity(entity);
    resetForm(entity);
    clearFilters();
  }

  return (
    <>
      <div className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">Total fields</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summaryStats.total}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">Required</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summaryStats.required}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold text-slate-500">
                Last updated
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summaryStats.lastUpdatedLabel}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-slate-500">
              Working inside{" "}
              <span className="font-semibold text-slate-900">
                {entityLabels[activeEntity]}
              </span>{" "}
              · {groupedDefinitions[activeEntity]?.length ?? 0} fields available
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopySchema}
                disabled={!definitions.length}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyStatus === "copied"
                  ? "Schema copied!"
                  : copyStatus === "error"
                  ? "Clipboard blocked"
                  : "Copy schema JSON"}
              </button>
              <a
                href="https://docs.chimera.dev/custom-fields"
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-transparent px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                View API docs ↗
              </a>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {entityOrder.map((entity) => (
              <button
                key={entity}
                type="button"
                onClick={() => handleEntityTabChange(entity)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                  activeEntity === entity
                    ? "border-sky-400 bg-sky-50 text-sky-700 shadow-sm"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <span>{entityIcons[entity]}</span>
                {entityLabels[entity]}
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-900 p-4 text-slate-100 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-wide text-slate-400">
              <span>Schema preview</span>
              <span>{entityLabels[activeEntity]}</span>
            </div>
            <pre className="mt-3 max-h-48 overflow-auto rounded-xl bg-slate-950/40 p-3 text-xs leading-relaxed text-slate-100">
              {schemaPreview}
            </pre>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {entityLabels[activeEntity]} fields
              </h2>
              <p className="text-xs text-slate-500">
                Manage, filter, and duplicate definitions scoped to this entity.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openCreateModal(activeEntity)}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
              >
                + New field
              </button>
              <button
                type="button"
                onClick={loadDefinitions}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600"
              >
                Refresh
              </button>
              {filtersApplied && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-transparent px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)]">
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 px-3 py-2">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name or key"
                    className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as CustomFieldType | "all")
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
                >
                  <option value="all">All field types</option>
                  {orderedFieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {fieldTypeMeta[type].label}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={showRequiredOnly}
                    onChange={(event) => setShowRequiredOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  Required only
                </label>
              </div>

              {listError && (
                <p className="text-xs font-medium text-red-600">{listError}</p>
              )}

              {loading && !definitions.length ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500">
                  Loading custom fields…
                </div>
              ) : filteredDefinitions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-sm text-slate-500">
                  No fields match your filters.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredDefinitions.map((definition) => (
                    <article
                      key={definition.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {definition.name}
                            </p>
                            {definition.is_required && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                                Required
                              </span>
                            )}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              {fieldTypeMeta[definition.field_type].label}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            Key: {definition.field_key} · Updated{" "}
                            {formatRelativeTime(definition.updated_at)}
                          </p>
                          {definition.description ? (
                            <p className="mt-2 text-sm text-slate-600">
                              {definition.description}
                            </p>
                          ) : null}
                          {definition.options && definition.options.length ? (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {definition.options.map((option) => (
                                <span
                                  key={option}
                                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                                >
                                  {option}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex gap-2 text-xs font-semibold text-slate-500">
                          <button
                            type="button"
                            onClick={() => handleCopyFieldKey(definition.field_key)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-slate-300 hover:text-slate-700"
                          >
                            Copy key
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(definition)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 hover:border-slate-300 hover:text-slate-700"
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(definition.id, definition.name)
                            }
                            className="rounded-lg border border-transparent px-3 py-1.5 text-rose-500 hover:border-rose-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <aside className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Entity coverage
                </p>
                <p className="text-xs text-slate-500">
                  {summaryStats.coverage} of {entityOrder.length} entities have at
                  least one field.
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  {entityOrder.map((entity) => (
                    <div
                      key={entity}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2"
                    >
                      <span className="text-slate-600">
                        {entityIcons[entity]} {entityLabels[entity]}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {groupedDefinitions[entity]?.length ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Tips for great fields
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                  <li>Use readable names; keep keys API-friendly.</li>
                  <li>Group dropdown options by workflows.</li>
                  <li>Mark required fields sparingly to reduce friction.</li>
                </ul>
                <a
                  href="mailto:support@chimera.dev?subject=Custom%20Field%20Help"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600"
                >
                  Need help? Contact us
                </a>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-1 text-sm text-slate-500 hover:bg-slate-200"
            >
              ✕
            </button>
            <h3 className="text-lg font-semibold text-slate-900">
              {prefillSource ? `Duplicate ${prefillSource}` : "Create custom field"}
            </h3>
            <p className="text-sm text-slate-500">
              {entityLabels[modalEntity]} · fields update instantly in APIs.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Display name
                <input
                  required
                  value={formState.name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormState((state) => ({
                      ...state,
                      name: value,
                      fieldKey: fieldKeyTouched
                        ? state.fieldKey
                        : slugifyFieldKey(value),
                      entityType: modalEntity,
                    }));
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none"
                  placeholder="e.g. Favorite feature"
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                  Field key
                  <div className="flex gap-2">
                    <input
                      value={formState.fieldKey}
                      onChange={(event) => {
                        setFieldKeyTouched(true);
                        setFormState((state) => ({
                          ...state,
                          fieldKey: slugifyFieldKey(event.target.value),
                        }));
                      }}
                      onFocus={() => setFieldKeyTouched(true)}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none"
                      placeholder="Auto-generated if blank"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormState((state) => ({
                          ...state,
                          fieldKey: slugifyFieldKey(
                            state.name || state.fieldKey
                          ),
                        }))
                      }
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:text-sky-600"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={formState.isRequired}
                    onChange={(event) =>
                      setFormState((state) => ({
                        ...state,
                        isRequired: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  Required
                </label>
              </div>

              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Description
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((state) => ({
                      ...state,
                      description: event.target.value,
                    }))
                  }
                  rows={2}
                  className="rounded-xl border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none"
                  placeholder="Optional helper text"
                />
              </label>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Field type
                </p>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {orderedFieldTypes.map((type) => {
                    const meta = fieldTypeMeta[type];
                    const isActiveType = formState.fieldType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setFormState((state) => ({
                            ...state,
                            fieldType: type,
                          }))
                        }
                        className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                          isActiveType
                            ? "border-sky-400 bg-sky-50 text-slate-900"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xl">{meta.icon}</span>
                        <span>
                          <span className="block text-sm font-semibold">
                            {meta.label}
                          </span>
                          <span className="text-xs text-slate-500">
                            {meta.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {isChoiceField && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Choice options
                      </p>
                      <p className="text-xs text-slate-500">
                        Add labels users can pick from.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={optionInput}
                        onChange={(event) => setOptionInput(event.target.value)}
                        onKeyDown={handleOptionKeyDown}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
                        placeholder="Type option & press Enter"
                      />
                      <button
                        type="button"
                        onClick={handleOptionAdd}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {selectOptions.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectOptions.map((option) => (
                        <span
                          key={option}
                          className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                        >
                          {option}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectOptions((prev) =>
                                prev.filter((value) => value !== option)
                              )
                            }
                            className="text-slate-400 hover:text-red-500"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">
                      No options yet. Add at least one to save this field.
                    </p>
                  )}
                </div>
              )}

              {prefillSource && (
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
                  Prefilled using “{prefillSource}”. Update values and save to
                  create a new field.
                  <button
                    type="button"
                    onClick={() => setPrefillSource(null)}
                    className="ml-2 font-semibold text-sky-700 hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}

              {formError && (
                <p className="text-xs font-medium text-red-600">{formError}</p>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-slate-500">
                  Fields become available immediately inside the APIs.
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => resetForm(modalEntity)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      !formState.name.trim() ||
                      (isChoiceField && !selectOptions.length)
                    }
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : "Create field"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
