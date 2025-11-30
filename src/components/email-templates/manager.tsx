"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type EmailTemplate = {
  id: string;
  name: string;
  description?: string | null;
  html?: string | null;
  amp_html?: string | null;
  design_json?: unknown;
  subject_line?: string | null;
  preheader_text?: string | null;
  updated_at?: string;
};

type ManagerProps = {
  templates: EmailTemplate[];
};

export function EmailTemplatesManager({ templates: initialTemplates }: ManagerProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    router.push("/dashboard/email-templates/new/editor");
  }

  function handleEdit(template: EmailTemplate) {
    router.push(`/dashboard/email-templates/${template.id}/editor`);
  }

  function handleDelete(templateId: string) {
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch(`/api/email-templates/${templateId}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to delete template.");
        }
        setTemplates((prev) => prev.filter((template) => template.id !== templateId));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to delete template.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Email templates
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              Drag & drop email builder
            </h1>
            <p className="text-sm text-slate-500">
              Design reusable campaigns quickly with emailbuilder.js.
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
          >
            + New template
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
            {error}
          </p>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
          <p className="text-sm text-slate-500">
            You haven’t created any templates yet.
          </p>
          <button
            onClick={handleCreate}
            className="mt-3 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
          >
            Start building
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <li
              key={template.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {template.name}
                  </h3>
                  {template.description ? (
                    <p className="text-sm text-slate-500">{template.description}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {template.updated_at
                    ? new Date(template.updated_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <button
                  onClick={() => handleEdit(template)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600"
                >
                  Edit
                </button>
                <button
                  disabled={isPending}
                  onClick={() => handleDelete(template.id)}
                  className="rounded-lg border border-transparent px-3 py-1.5 font-semibold text-rose-500 hover:text-rose-600 disabled:opacity-50"
                >
                  Delete
                </button>
                {template.html ? (
                  <a
                    href={`data:text/html;charset=utf-8,${encodeURIComponent(
                      template.html
                    )}`}
                    download={`${template.name}.html`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600"
                  >
                    Download HTML
                  </a>
                ) : null}
                {template.amp_html ? (
                  <a
                    href={`data:text/html;charset=utf-8,${encodeURIComponent(
                      template.amp_html
                    )}`}
                    download={`${template.name}-amp.html`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:border-sky-200 hover:text-sky-600"
                  >
                    Download AMP
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
