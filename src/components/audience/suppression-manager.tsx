"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type SuppressionEntry = {
  id: string;
  reason: string | null;
  created_at: string;
  suppression_list?: {
    id: string;
    name: string;
    scope: string;
  } | null;
};

type SuppressionManagerProps = {
  audienceId: string;
  email: string;
  entries: SuppressionEntry[];
};

export function SuppressionManager({
  audienceId,
  email,
  entries,
}: SuppressionManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refreshAfter(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  async function handleAdd(reason: string) {
    await fetch("/api/suppressions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audienceId,
        email,
        reason,
      }),
    });
  }

  async function handleRemove(entryId: string) {
    await fetch(`/api/suppressions/${entryId}`, {
      method: "DELETE",
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          disabled={isPending}
          onClick={() => refreshAfter(() => handleAdd("Manually suppressed"))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
        >
          Add to global suppression
        </button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">
          This contact is not currently suppressed.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/60"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-gray-100">
                  {entry.suppression_list?.name ?? "Suppressed"}
                </p>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  {entry.reason ?? "No reason provided"} ·{" "}
                  {new Date(entry.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={() => refreshAfter(() => handleRemove(entry.id))}
                className="text-xs font-semibold text-rose-500 transition hover:text-rose-600 disabled:opacity-60"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
