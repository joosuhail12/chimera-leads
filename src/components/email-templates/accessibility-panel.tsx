"use client";

import { AlertTriangle, CheckCircle, Info, XCircle, Award, Target } from "lucide-react";
import type { AccessibilityReport, AccessibilityIssue } from "@/lib/email/accessibility-checker";

interface AccessibilityPanelProps {
  report: AccessibilityReport;
  onIssueClick?: (issue: AccessibilityIssue) => void;
}

export function AccessibilityPanel({ report, onIssueClick }: AccessibilityPanelProps) {
  const { score, issues, stats, passedChecks } = report;

  // Determine score color and label
  const getScoreColor = (score: number) => {
    if (score >= 90) return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Excellent" };
    if (score >= 75) return { bg: "bg-sky-100", text: "text-sky-700", label: "Good" };
    if (score >= 50) return { bg: "bg-amber-100", text: "text-amber-700", label: "Needs Work" };
    return { bg: "bg-rose-100", text: "text-rose-700", label: "Poor" };
  };

  const scoreStyle = getScoreColor(score);

  return (
    <div className="space-y-4">
      {/* Score Card */}
      <div className={`rounded-xl border p-4 ${scoreStyle.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Award className={`h-5 w-5 ${scoreStyle.text}`} />
              <h3 className={`text-sm font-semibold ${scoreStyle.text}`}>
                Accessibility Score
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Based on WCAG 2.1 guidelines
            </p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${scoreStyle.text}`}>{score}</div>
            <div className={`text-xs font-semibold ${scoreStyle.text}`}>{scoreStyle.label}</div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {(stats.critical > 0 || stats.serious > 0 || stats.moderate > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-center">
            <div className="text-xl font-bold text-rose-700">{stats.critical}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-rose-600">
              Critical
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
            <div className="text-xl font-bold text-amber-700">{stats.serious}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Serious
            </div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-center">
            <div className="text-xl font-bold text-sky-700">{stats.moderate}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-600">
              Moderate
            </div>
          </div>
        </div>
      )}

      {/* Passed Checks */}
      {passedChecks.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-semibold text-emerald-900">Passed Checks</h4>
          </div>
          <ul className="space-y-1">
            {passedChecks.map((check, idx) => (
              <li key={idx} className="text-xs text-emerald-700 flex items-center gap-1">
                <span className="text-emerald-400">✓</span> {check}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues List */}
      {issues.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Issues Found</h4>
          {issues.map((issue) => (
            <AccessibilityIssueCard
              key={issue.id}
              issue={issue}
              onClick={onIssueClick ? () => onIssueClick(issue) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
          <p className="text-sm font-semibold text-emerald-900">No accessibility issues found!</p>
          <p className="text-xs text-emerald-700 mt-1">
            Your email meets WCAG accessibility standards.
          </p>
        </div>
      )}
    </div>
  );
}

interface AccessibilityIssueCardProps {
  issue: AccessibilityIssue;
  onClick?: () => void;
}

function AccessibilityIssueCard({ issue, onClick }: AccessibilityIssueCardProps) {
  const Icon =
    issue.severity === "critical"
      ? XCircle
      : issue.severity === "serious"
      ? AlertTriangle
      : Info;

  const colorClasses =
    issue.severity === "critical"
      ? { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-600", text: "text-rose-900" }
      : issue.severity === "serious"
      ? { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", text: "text-amber-900" }
      : { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-600", text: "text-sky-900" };

  return (
    <div
      className={`rounded-xl border p-3 ${colorClasses.bg} ${colorClasses.border} ${onClick ? "cursor-pointer hover:shadow-sm transition" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${colorClasses.icon}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h5 className={`text-sm font-semibold ${colorClasses.text}`}>{issue.title}</h5>
            {issue.wcagLevel && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colorClasses.text} opacity-60`}
              >
                WCAG {issue.wcagLevel}
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${colorClasses.text} opacity-90`}>{issue.message}</p>
          {issue.suggestion && (
            <div className={`mt-2 rounded-lg border ${colorClasses.border} bg-white p-2`}>
              <div className="flex items-start gap-1.5">
                <Target className={`h-3 w-3 flex-shrink-0 mt-0.5 ${colorClasses.icon}`} />
                <p className="text-xs text-slate-700">{issue.suggestion}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Badge component for header
interface AccessibilityBadgeProps {
  score: number;
  issueCount: number;
}

export function AccessibilityBadge({ score, issueCount }: AccessibilityBadgeProps) {
  if (score >= 90) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-1">
        <CheckCircle className="h-3 w-3 text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700">A11y: {score}</span>
      </div>
    );
  }

  if (score >= 75) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100 px-2 py-1">
        <Info className="h-3 w-3 text-sky-600" />
        <span className="text-xs font-semibold text-sky-700">A11y: {score}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2 py-1">
      <AlertTriangle className="h-3 w-3 text-amber-600" />
      <span className="text-xs font-semibold text-amber-700">
        A11y: {score} ({issueCount})
      </span>
    </div>
  );
}
