"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SimpleVariableAutocomplete } from "./simple-variable-autocomplete";
import type { VariableDefinition } from "@/lib/email/variable-parser";

interface SubjectPreheaderWithAutocompleteProps {
  subjectLine: string;
  preheaderText: string;
  onSubjectChange: (value: string) => void;
  onPreheaderChange: (value: string) => void;
  variables?: VariableDefinition[];
  sampleData?: Record<string, string>;
}

export function SubjectPreheaderWithAutocomplete({
  subjectLine,
  preheaderText,
  onSubjectChange,
  onPreheaderChange,
  variables = [],
  sampleData = {},
}: SubjectPreheaderWithAutocompleteProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate character counts
  const subjectLength = subjectLine.length;
  const preheaderLength = preheaderText.length;

  // Determine color coding for character counts
  const getSubjectColor = () => {
    if (subjectLength === 0) return "text-gray-400";
    if (subjectLength <= 60) return "text-green-600";
    if (subjectLength <= 80) return "text-amber-600";
    return "text-red-600";
  };

  const getPreheaderColor = () => {
    if (preheaderLength === 0) return "text-gray-400";
    if (preheaderLength <= 100) return "text-green-600";
    if (preheaderLength <= 140) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-6 py-3 hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-inset"
        type="button"
        aria-expanded={isExpanded}
        aria-label="Toggle email metadata editor"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500 transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500 transition-transform" />
          )}
          <h3 className="text-sm font-semibold text-slate-900">
            Email Metadata
          </h3>
          {(subjectLine || preheaderText) && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Configured
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">
          {subjectLine || preheaderText
            ? `${subjectLength + preheaderLength} chars total`
            : "Click to add subject & preheader"}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Subject Line */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="subject-line"
                className="block text-sm font-medium text-slate-700"
              >
                Subject Line
              </label>
              <span className="text-xs text-slate-500">
                Type {`{{`} for variables
              </span>
            </div>
            <div className="relative">
              <SimpleVariableAutocomplete
                value={subjectLine}
                onChange={onSubjectChange}
                variables={variables}
                sampleData={sampleData}
                placeholder="e.g., New product launch: 50% off {{firstName}}!"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-shadow resize-none"
                rows={1}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className={`text-xs font-medium ${getSubjectColor()} transition-colors`}>
                {subjectLength} characters
              </p>
              <p id="subject-line-hint" className="text-xs text-slate-500">
                Recommended: 60 characters
              </p>
            </div>
          </div>

          {/* Preheader Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="preheader-text"
                className="block text-sm font-medium text-slate-700"
              >
                Preheader Text
                <span className="ml-1 text-xs font-normal text-slate-500">
                  (Preview text in inbox)
                </span>
              </label>
              <span className="text-xs text-slate-500">
                Type {`{{`} for variables
              </span>
            </div>
            <div className="relative">
              <SimpleVariableAutocomplete
                value={preheaderText}
                onChange={onPreheaderChange}
                variables={variables}
                sampleData={sampleData}
                placeholder="e.g., Don't miss this exclusive offer just for you..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-sm transition-shadow resize-none"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className={`text-xs font-medium ${getPreheaderColor()} transition-colors`}>
                {preheaderLength} characters
              </p>
              <p id="preheader-text-hint" className="text-xs text-slate-500">
                Recommended: 100 characters
              </p>
            </div>
          </div>

          {/* Info Box */}
          <div className="rounded-xl bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900">💡 Pro Tips:</strong>
              <br />
              • Type <code className="bg-white px-1.5 py-0.5 rounded font-mono text-slate-800 border border-slate-200">{`{{`}</code> to insert variables like{" "}
              <code className="bg-white px-1.5 py-0.5 rounded font-mono text-slate-800 border border-slate-200">
                {`{{firstName}}`}
              </code>
              <br />
              • Use <kbd className="px-1 py-0.5 bg-white rounded border border-slate-300 text-[10px]">↑↓</kbd> to navigate,
              {" "}<kbd className="px-1 py-0.5 bg-white rounded border border-slate-300 text-[10px]">Enter</kbd> to insert
              <br />
              • Subject and preheader are the first things recipients see
            </p>
          </div>
        </div>
      )}
    </div>
  );
}