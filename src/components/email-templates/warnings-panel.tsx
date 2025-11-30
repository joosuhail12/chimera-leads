"use client";

import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import type { BlockWarning } from "@/lib/email/block-validator";

interface WarningsPanelProps {
  warnings: BlockWarning[];
  onActionClick?: (warning: BlockWarning) => void;
}

export function WarningsPanel({ warnings, onActionClick }: WarningsPanelProps) {
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <p className="text-sm text-emerald-700">No issues found with this block</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning) => {
        const Icon =
          warning.severity === "error"
            ? XCircle
            : warning.severity === "warning"
            ? AlertTriangle
            : Info;

        const colorClasses =
          warning.severity === "error"
            ? "bg-rose-50 border-rose-200"
            : warning.severity === "warning"
            ? "bg-amber-50 border-amber-200"
            : "bg-sky-50 border-sky-200";

        const iconColorClasses =
          warning.severity === "error"
            ? "text-rose-600"
            : warning.severity === "warning"
            ? "text-amber-600"
            : "text-sky-600";

        const textColorClasses =
          warning.severity === "error"
            ? "text-rose-900"
            : warning.severity === "warning"
            ? "text-amber-900"
            : "text-sky-900";

        const buttonColorClasses =
          warning.severity === "error"
            ? "text-rose-700 hover:text-rose-900 hover:bg-rose-100"
            : warning.severity === "warning"
            ? "text-amber-700 hover:text-amber-900 hover:bg-amber-100"
            : "text-sky-700 hover:text-sky-900 hover:bg-sky-100";

        return (
          <div
            key={warning.id}
            className={`flex items-start gap-2 rounded-xl border p-3 ${colorClasses}`}
          >
            <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${iconColorClasses}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${textColorClasses}`}>
                {warning.title}
              </p>
              <p className={`text-xs mt-0.5 ${textColorClasses} opacity-90`}>
                {warning.message}
              </p>
              {warning.actionLabel && onActionClick && (
                <button
                  onClick={() => onActionClick(warning)}
                  className={`mt-2 text-xs font-semibold underline transition-colors ${buttonColorClasses}`}
                >
                  {warning.actionLabel}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Badge component to show warning count
interface WarningsBadgeProps {
  count: number;
  severity?: "error" | "warning" | "info";
}

export function WarningsBadge({ count, severity = "warning" }: WarningsBadgeProps) {
  if (count === 0) return null;

  const colorClasses =
    severity === "error"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : severity === "warning"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-sky-100 text-sky-700 border-sky-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colorClasses}`}
    >
      {severity === "error" ? (
        <XCircle className="h-2.5 w-2.5" />
      ) : severity === "warning" ? (
        <AlertTriangle className="h-2.5 w-2.5" />
      ) : (
        <Info className="h-2.5 w-2.5" />
      )}
      {count}
    </span>
  );
}
