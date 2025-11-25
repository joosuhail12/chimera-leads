"use client";

import { useEffect, useMemo, useState } from "react";

type CustomEntityType = "sales_leads" | "audience" | "startup_applications";
type CustomFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiselect";

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
  audience: "Audience contacts",
  startup_applications: "Startup applications",
};

const fieldTypeLabels: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "Boolean",
  date: "Date",
  select: "Select (single)",
  multiselect: "Select (multi)",
};

type FormState = {
  entityType: CustomEntityType;
  name: string;
  fieldKey: string;
  description: string;
  fieldType: CustomFieldType;
  options: string;
  isRequired: boolean;
};

const defaultFormState: FormState = {
  entityType: "sales_leads",
  name: "",
  fieldKey: "",
  description: "",
  fieldType: "text",
  options: "",
  isRequired: false,
};

export function CustomFieldsManager() {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [submitting, setSubmitting] = useState(false);

  const groupedDefinitions = useMemo(() => {
    return definitions.reduce<Record<CustomEntityType, CustomFieldDefinition[]>>(
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

  async function loadDefinitions() {
    setLoading(true);
    setError(null);
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
      setError(
        err instanceof Error ? err.message : "Failed to load custom fields."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDefinitions();
  }, []);

  const optionsArray = formState.options
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
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
              ? optionsArray
              : undefined,
          isRequired: formState.isRequired,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create custom field.");
      }

      setFormState(defaultFormState);
      await loadDefinitions();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Failed to create custom field."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(definitionId: string) {
    if (
      !window.confirm(
        "Deleting this custom field will remove its values from all records. Continue?"
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
      setError(
        err instanceof Error ? err.message : "Failed to delete custom field."
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">New field</h2>
        <p className="text-sm text-slate-500">
          Configure a reusable attribute for any entity. Field keys become part of
          the API payloads and exports.
        </p>
        <form
          onSubmit={handleSubmit}
          className="mt-4 grid gap-4 md:grid-cols-2"
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Entity
            <select
              value={formState.entityType}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  entityType: event.target.value as CustomEntityType,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
            >
              {Object.entries(entityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Field type
            <select
              value={formState.fieldType}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  fieldType: event.target.value as CustomFieldType,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
            >
              {Object.entries(fieldTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Display name
            <input
              required
              value={formState.name}
              onChange={(event) =>
                setFormState((state) => ({ ...state, name: event.target.value }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="e.g. Favorite feature"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            Field key
            <input
              value={formState.fieldKey}
              onChange={(event) =>
                setFormState((state) => ({
                  ...state,
                  fieldKey: event.target.value,
                }))
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
              placeholder="Auto-generated if left blank"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
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
              placeholder="Optional helper text"
            />
          </label>
          {(formState.fieldType === "select" ||
            formState.fieldType === "multiselect") && (
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700 md:col-span-2">
              Options (comma separated)
              <input
                value={formState.options}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    options: event.target.value,
                  }))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-300 focus:outline-none"
                placeholder="e.g. Activation, Billing, Integrations"
              />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
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
          <div className="md:col-span-2 flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={submitting || !formState.name.trim()}
              className="rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-lg disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Create field"}
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
            Existing fields
          </h2>
          <button
            type="button"
            onClick={loadDefinitions}
            className="text-sm font-semibold text-sky-600 hover:text-sky-500"
          >
            Refresh
          </button>
        </div>

        {loading && !definitions.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading custom fields…
          </div>
        ) : (
          <div className="space-y-6">
            {(
              Object.keys(entityLabels) as CustomEntityType[]
            ).map((entityType) => (
              <div key={entityType} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {entityLabels[entityType]}
                  </h3>
                  <span className="text-xs text-slate-500">
                    {(groupedDefinitions[entityType] ?? []).length} fields
                  </span>
                </div>
                {groupedDefinitions[entityType]?.length ? (
                  <div className="space-y-3">
                    {groupedDefinitions[entityType].map((definition) => (
                      <article
                        key={definition.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {definition.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {definition.field_key} ·{" "}
                              {fieldTypeLabels[definition.field_type]}
                            </p>
                            {definition.description ? (
                              <p className="mt-1 text-xs text-slate-500">
                                {definition.description}
                              </p>
                            ) : null}
                            {definition.options &&
                            definition.options.length ? (
                              <p className="mt-1 text-xs text-slate-400">
                                Options: {definition.options.join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDelete(definition.id)}
                            className="text-xs font-semibold text-slate-400 transition hover:text-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-500">
                    No custom fields yet.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
