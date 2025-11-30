"use client";

import { useState, useMemo } from "react";
import { Search, Star, GripVertical, User, Sparkles, Calendar, Settings } from "lucide-react";
import type { VariableDefinition, VariableCategory } from "@/lib/email/variable-parser";

interface VariableLibraryProps {
  variables: {
    builtIn: VariableDefinition[];
    customFields: VariableDefinition[];
    campaign: VariableDefinition[];
    system: VariableDefinition[];
  };
  usedVariables: string[];
  onInsertVariable: (variableKey: string) => void;
  onDragStart?: (variableKey: string, e: React.DragEvent) => void;
}

type TabKey = "all" | "contact" | "custom" | "campaign" | "system";

const CATEGORY_ICONS: Record<VariableCategory, React.ComponentType<{ className?: string }>> = {
  contact: User,
  custom: Sparkles,
  campaign: Calendar,
  system: Settings,
};

const CATEGORY_COLORS: Record<VariableCategory, string> = {
  contact: "text-blue-600 bg-blue-50",
  custom: "text-purple-600 bg-purple-50",
  campaign: "text-green-600 bg-green-50",
  system: "text-gray-600 bg-gray-50",
};

export function VariableLibrary({
  variables,
  usedVariables,
  onInsertVariable,
  onDragStart,
}: VariableLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Flatten all variables
  const allVariables = useMemo(
    () => [
      ...variables.builtIn,
      ...variables.customFields,
      ...variables.campaign,
      ...variables.system,
    ],
    [variables]
  );

  // Filter variables based on search and active tab
  const filteredVariables = useMemo(() => {
    let filtered = allVariables;

    // Filter by tab
    if (activeTab !== "all") {
      filtered = filtered.filter((v) => v.category === activeTab);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.key.toLowerCase().includes(query) ||
          v.label.toLowerCase().includes(query) ||
          v.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allVariables, activeTab, searchQuery]);

  // Count usage of each variable
  const getUsageCount = (variableKey: string) => {
    return usedVariables.filter((v) => v === variableKey).length;
  };

  // Toggle favorite
  const toggleFavorite = (variableKey: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(variableKey)) {
      newFavorites.delete(variableKey);
    } else {
      newFavorites.add(variableKey);
    }
    setFavorites(newFavorites);
    // Persist to localStorage
    localStorage.setItem("email-builder-favorite-variables", JSON.stringify(Array.from(newFavorites)));
  };

  // Load favorites from localStorage on mount
  useState(() => {
    try {
      const stored = localStorage.getItem("email-builder-favorite-variables");
      if (stored) {
        setFavorites(new Set(JSON.parse(stored) as string[]));
      }
    } catch {
      // Ignore parse errors
    }
  });

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: "all", label: "All", count: allVariables.length },
    { key: "contact", label: "Contact", count: variables.builtIn.length },
    { key: "custom", label: "Custom Fields", count: variables.customFields.length },
    { key: "campaign", label: "Campaign", count: variables.campaign.length },
    { key: "system", label: "System", count: variables.system.length },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Variables</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
            aria-label="Search variables"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 ${
              activeTab === tab.key
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            type="button"
            aria-label={`Show ${tab.label} variables`}
            aria-pressed={activeTab === tab.key}
          >
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                activeTab === tab.key ? "bg-slate-700 text-slate-100" : "bg-slate-200 text-slate-600"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredVariables.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">
              {searchQuery ? "No variables found" : "No variables available"}
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery ? "Try adjusting your search query" : "Variables will appear here once configured"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredVariables.map((variable) => {
              const usageCount = getUsageCount(variable.key);
              const Icon = CATEGORY_ICONS[variable.category];
              const isFavorite = favorites.has(variable.key);

              return (
                <div
                  key={variable.key}
                  draggable={!!onDragStart}
                  onDragStart={(e) => onDragStart?.(variable.key, e)}
                  className="group relative p-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm transition-all cursor-pointer focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-1"
                  onClick={() => onInsertVariable(variable.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onInsertVariable(variable.key);
                    }
                  }}
                  aria-label={`Insert ${variable.label} variable`}
                >
                  {/* Drag Handle */}
                  {onDragStart && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-slate-400" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex items-start gap-2 ml-4">
                    {/* Category Icon */}
                    <div className={`flex-shrink-0 p-1.5 rounded ${CATEGORY_COLORS[variable.category]}`}>
                      <Icon className="h-3 w-3" />
                    </div>

                    {/* Variable Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {variable.label}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(variable.key);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-slate-200 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                          type="button"
                          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Star
                            className={`h-3.5 w-3.5 transition-colors ${
                              isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-400 hover:text-slate-600"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Variable Syntax */}
                      <code className="block text-xs font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded mb-1.5 truncate">
                        {"{"}
                        {"{"}
                        {variable.key}
                        {"}}"}
                      </code>

                      {/* Description */}
                      {variable.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 mb-1">
                          {variable.description}
                        </p>
                      )}

                      {/* Example Value */}
                      {variable.exampleValue && (
                        <p className="text-xs text-slate-500 mt-1">
                          <span className="font-medium">Example:</span> {variable.exampleValue}
                        </p>
                      )}

                      {/* Usage Count */}
                      {usageCount > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                            Used {usageCount}× in template
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Tip */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
        <p className="text-xs text-slate-700">
          💡 <strong className="text-slate-900">Tip:</strong> Click to insert or drag into any text field
        </p>
      </div>
    </div>
  );
}
