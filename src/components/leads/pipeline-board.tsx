"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LeadStatus, LEAD_STATUSES } from "@/lib/constants/leads";

type LeadCard = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  status: LeadStatus;
  updated_at: string | null;
};

type PipelineBoardProps = {
  columns: Record<LeadStatus, LeadCard[]>;
};

export function LeadsPipelineBoard({ columns }: PipelineBoardProps) {
  const [board, setBoard] = useState(columns);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<LeadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const columnData = useMemo(() => {
    return LEAD_STATUSES.map((status) => ({
      ...status,
      leads: board[status.value] ?? [],
    }));
  }, [board]);

  const startDrag = (leadId: string) => {
    setDraggedLeadId(leadId);
    setError(null);
  };

  const cancelDrag = () => {
    setDraggedLeadId(null);
    setPendingStatus(null);
  };

  const moveLeadLocally = (
    state: typeof board,
    leadId: string,
    targetStatus: LeadStatus
  ) => {
    const nextState: typeof board = {} as typeof board;
    let movingLead: LeadCard | null = null;

    (Object.keys(state) as LeadStatus[]).forEach((key) => {
      const leads = state[key];
      const filtered = leads.filter((lead) => {
        if (lead.id === leadId) {
          movingLead = { ...lead, status: targetStatus };
          return false;
        }
        return true;
      });
      nextState[key] = filtered;
    });

    if (!movingLead) {
      // Lead might not have been in state (shouldn't happen)
      return state;
    }

    nextState[targetStatus] = [
      movingLead,
      ...(nextState[targetStatus] ?? []),
    ];

    return nextState;
  };

  const handleDrop = async (targetStatus: LeadStatus) => {
    if (!draggedLeadId) return;

    setPendingStatus(targetStatus);
    const previousState = Object.fromEntries(
      (Object.entries(board) as [LeadStatus, LeadCard[]][]).map(
        ([status, leads]) => [status, [...leads]]
      )
    ) as typeof board;
    const optimistic = moveLeadLocally(board, draggedLeadId, targetStatus);
    setBoard(optimistic);

    try {
      const response = await fetch(`/api/leads/${draggedLeadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update lead status");
      }
    } catch (err) {
      console.error(err);
      setBoard(previousState);
      setError("Could not update lead. Please try again.");
    } finally {
      cancelDrag();
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {columnData.map((column) => (
          <section
            key={column.value}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(column.value as LeadStatus);
            }}
            className={`flex min-h-[420px] flex-col rounded-2xl border px-4 py-3 transition-colors ${
              pendingStatus === column.value
                ? "border-chimera-teal/60 bg-chimera-teal/5"
                : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            }`}
          >
            <header className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {column.label}
                </p>
                <p className="text-xs text-gray-400">{column.leads.length} leads</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                {column.value}
              </span>
            </header>

            <div className="flex-1 space-y-3 overflow-auto pb-2">
              {column.leads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400 dark:border-gray-800">
                  Drop leads here
                </div>
              ) : (
                column.leads.map((lead) => (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => startDrag(lead.id)}
                    onDragEnd={cancelDrag}
                    className="cursor-grab rounded-xl border border-gray-200 bg-white/90 px-3 py-2.5 shadow-sm transition hover:border-chimera-teal/40 dark:border-gray-800 dark:bg-gray-900"
                  >
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="flex flex-col gap-1"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {lead.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lead.company ?? lead.email}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-gray-400">
                        Updated {formatRelative(lead.updated_at)}
                      </p>
                    </Link>
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function formatRelative(timestamp: string | null): string {
  if (!timestamp) return "just now";
  const date = new Date(timestamp);
  const diff = Date.now() - date.getTime();
  if (diff < 1000 * 60) return "just now";
  if (diff < 1000 * 60 * 60)
    return `${Math.floor(diff / (1000 * 60))}m ago`;
  if (diff < 1000 * 60 * 60 * 24)
    return `${Math.floor(diff / (1000 * 60 * 60))}h ago`;
  return date.toLocaleDateString();
}
