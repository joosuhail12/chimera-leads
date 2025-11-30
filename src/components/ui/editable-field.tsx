"use client";

import { useState, type ReactNode } from "react";

type EditableFieldProps = {
  label: string;
  value?: string | number | null;
  patchUrl: string;
  payloadKey?: string;
  buildPayload?: (value: string) => Record<string, unknown>;
  type?: "text" | "textarea" | "select" | "number";
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
  displayMode?: "text" | "email" | "url" | "chips";
  helperText?: string;
  className?: string;
};

function toInputValue(value?: string | number | null) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function EditableField({
  label,
  value = "",
  patchUrl,
  payloadKey,
  buildPayload,
  type = "text",
  options = [],
  placeholder,
  displayMode = "text",
  helperText,
  className = "",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(toInputValue(value));
  const [displayValue, setDisplayValue] = useState<string | number | null>(
    value ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleStartEdit() {
    setInputValue(toInputValue(displayValue));
    setIsEditing(true);
    setError(null);
  }

  async function handleSave() {
    if (!payloadKey && !buildPayload) {
      console.error("EditableField: payloadKey or buildPayload is required.");
      return;
    }

    const normalizedValue =
      type === "number" ? (inputValue === "" ? null : Number(inputValue)) : inputValue;

    const payload = buildPayload
      ? buildPayload(inputValue)
      : { [payloadKey as string]: normalizedValue };

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save field.");
      }

      setDisplayValue(normalizedValue);
      setIsEditing(false);
    } catch (err) {
      console.error(`EditableField (${label}) save failed`, err);
      setError(err instanceof Error ? err.message : "Failed to save field.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setInputValue(toInputValue(displayValue));
    setError(null);
    setIsEditing(false);
  }

  const resolvedDisplayValue =
    displayValue !== null && displayValue !== undefined ? displayValue : "";

  let displayContent: ReactNode = "Not set";
  const hasDisplay =
    resolvedDisplayValue !== null &&
    resolvedDisplayValue !== undefined &&
    resolvedDisplayValue !== "";

  if (hasDisplay) {
    if (type === "select") {
      const selected = options.find(
        (option) => option.value === String(resolvedDisplayValue)
      );
      displayContent = selected?.label ?? String(resolvedDisplayValue);
    } else if (displayMode === "email") {
      const emailValue = String(resolvedDisplayValue);
      displayContent = (
        <a href={`mailto:${emailValue}`} className="text-sky-600 hover:underline">
          {emailValue}
        </a>
      );
    } else if (displayMode === "url") {
      const urlValue = String(resolvedDisplayValue);
      const href = urlValue.startsWith("http") ? urlValue : `https://${urlValue}`;
      displayContent = (
        <a href={href} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">
          {urlValue}
        </a>
      );
    } else if (displayMode === "chips") {
      const chips = String(resolvedDisplayValue)
        .split(",")
        .map((chip) => chip.trim())
        .filter(Boolean);
      displayContent = chips.length ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : (
        "Not set"
      );
    } else {
      displayContent = String(resolvedDisplayValue);
    }
  }

  const containerClass = [
    "space-y-1 rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/60",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-slate-400 dark:text-gray-500">
        <span>{label}</span>
        {!isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="text-slate-500 transition hover:text-slate-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          {type === "textarea" ? (
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              rows={4}
            />
          ) : type === "select" ? (
            <select
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type === "number" ? "number" : "text"}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          )}
          {helperText ? (
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {helperText}
            </p>
          ) : null}
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-900 dark:text-gray-100">
          {displayContent}
        </p>
      )}
    </div>
  );
}
