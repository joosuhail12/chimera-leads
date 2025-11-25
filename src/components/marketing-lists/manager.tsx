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
};

const toCsv = (values?: string[]) => values?.join(", ") ?? "";

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
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      });
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
            {activeLists.map((list) => (
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
                    <dd>{toCsv(list.filters.sources)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Tags
                    </dt>
                    <dd>{toCsv(list.filters.tags)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Fit score
                    </dt>
                    <dd>
                      {list.filters.minCustomerFitScore
                        ? `${list.filters.minCustomerFitScore}+`
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
                </dl>
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
            ))}
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
            {archivedLists.map((list) => (
              <article
                key={list.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-500"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{list.name}</p>
                  <span className="text-xs">{list.member_count} members</span>
                </div>
                <p className="mt-1 text-xs">{list.description}</p>
                <button
                  type="button"
                  onClick={() => toggleArchive(list, false)}
                  className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                >
                  Restore
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
