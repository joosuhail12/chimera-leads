"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Star,
  User,
  Sparkles,
  Calendar,
  Settings,
  Copy,
  Check,
  ChevronRight,
  Hash,
  Mail,
  Building,
  MapPin,
  Phone,
  Globe,
  Clock,
  Filter,
  X
} from "lucide-react";
import type { VariableDefinition, VariableCategory } from "@/lib/email/variable-parser";

interface EnhancedVariableLibraryProps {
  variables: {
    builtIn: VariableDefinition[];
    customFields: VariableDefinition[];
    campaign: VariableDefinition[];
    system: VariableDefinition[];
  };
  usedVariables: string[];
  sampleData: Record<string, string>;
  onInsertVariable: (variableKey: string) => void;
}

type TabKey = "all" | "favorites" | "recent" | "contact" | "custom" | "campaign" | "system";

const CATEGORY_CONFIG: Record<VariableCategory, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  contact: {
    icon: User,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    label: "Contact"
  },
  custom: {
    icon: Sparkles,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    label: "Custom Fields"
  },
  campaign: {
    icon: Calendar,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    label: "Campaign"
  },
  system: {
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-50",
    borderColor: "border-slate-200",
    label: "System"
  },
};

// Icon mapping for common variable types
const VARIABLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  firstName: User,
  lastName: User,
  email: Mail,
  company: Building,
  address: MapPin,
  phone: Phone,
  website: Globe,
  date: Calendar,
  time: Clock,
  count: Hash,
};

export function EnhancedVariableLibrary({
  variables,
  usedVariables,
  sampleData,
  onInsertVariable,
}: EnhancedVariableLibraryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<VariableCategory>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Load saved data from localStorage
  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem("email-builder-favorite-variables");
      if (storedFavorites) setFavorites(new Set(JSON.parse(storedFavorites)));

      const storedRecent = localStorage.getItem("email-builder-recent-variables");
      if (storedRecent) setRecentlyUsed(JSON.parse(storedRecent));
    } catch {
      // Ignore parse errors
    }
  }, []);

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

  // Get favorite and recent variables
  const favoriteVariables = useMemo(
    () => allVariables.filter(v => favorites.has(v.key)),
    [allVariables, favorites]
  );

  const recentVariables = useMemo(
    () => recentlyUsed
      .map(key => allVariables.find(v => v.key === key))
      .filter(Boolean) as VariableDefinition[],
    [allVariables, recentlyUsed]
  );

  // Filter variables based on search, tab, and filters
  const filteredVariables = useMemo(() => {
    let filtered = allVariables;

    // Filter by tab
    switch (activeTab) {
      case "favorites":
        filtered = favoriteVariables;
        break;
      case "recent":
        filtered = recentVariables;
        break;
      case "all":
        // Keep all
        break;
      default:
        filtered = filtered.filter((v) => v.category === activeTab);
    }

    // Filter by selected categories (if filters are active)
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(v => selectedCategories.has(v.category));
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
  }, [allVariables, favoriteVariables, recentVariables, activeTab, searchQuery, selectedCategories]);

  // Toggle favorite
  const toggleFavorite = (variableKey: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(variableKey)) {
      newFavorites.delete(variableKey);
    } else {
      newFavorites.add(variableKey);
    }
    setFavorites(newFavorites);
    localStorage.setItem("email-builder-favorite-variables", JSON.stringify(Array.from(newFavorites)));
  };

  // Add to recently used
  const addToRecentlyUsed = (variableKey: string) => {
    const newRecent = [variableKey, ...recentlyUsed.filter(k => k !== variableKey)].slice(0, 10);
    setRecentlyUsed(newRecent);
    localStorage.setItem("email-builder-recent-variables", JSON.stringify(newRecent));
  };

  // Copy variable to clipboard
  const copyToClipboard = async (variableKey: string) => {
    try {
      await navigator.clipboard.writeText(`{{${variableKey}}}`);
      setCopiedVariable(variableKey);
      setTimeout(() => setCopiedVariable(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = `{{${variableKey}}}`;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedVariable(variableKey);
      setTimeout(() => setCopiedVariable(null), 2000);
    }
  };

  // Handle variable insertion
  const handleInsertVariable = (variableKey: string) => {
    onInsertVariable(variableKey);
    addToRecentlyUsed(variableKey);
  };

  // Toggle category filter
  const toggleCategoryFilter = (category: VariableCategory) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSelectedCategories(newCategories);
  };

  const tabs: Array<{ key: TabKey; label: string; icon?: React.ComponentType<{ className?: string }>; count: number }> = [
    { key: "all", label: "All", count: allVariables.length },
    { key: "favorites", label: "Favorites", icon: Star, count: favoriteVariables.length },
    { key: "recent", label: "Recent", icon: Clock, count: recentVariables.length },
    { key: "contact", label: "Contact", icon: User, count: variables.builtIn.length },
    { key: "custom", label: "Custom", icon: Sparkles, count: variables.customFields.length },
    { key: "campaign", label: "Campaign", icon: Calendar, count: variables.campaign.length },
    { key: "system", label: "System", icon: Settings, count: variables.system.length },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Variables</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1.5 rounded-lg transition-colors ${
              showFilters || selectedCategories.size > 0
                ? "bg-slate-900 text-white"
                : "hover:bg-slate-100 text-slate-600"
            }`}
            aria-label="Toggle filters"
          >
            <Filter className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search variables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 text-sm border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
            >
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const category = key as VariableCategory;
              const isSelected = selectedCategories.has(category);
              return (
                <button
                  key={category}
                  onClick={() => toggleCategoryFilter(category)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    isSelected
                      ? `${config.bgColor} ${config.color} ${config.borderColor} border`
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <config.icon className="h-3 w-3" />
                  {config.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  activeTab === tab.key ? "bg-slate-700" : "bg-slate-200 text-slate-600"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto p-3">
        {filteredVariables.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-900 mb-1">
              {searchQuery ? "No variables found" : "No variables available"}
            </p>
            <p className="text-xs text-slate-500">
              {searchQuery ? "Try adjusting your search" : "Add variables to see them here"}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredVariables.map((variable) => {
              const config = CATEGORY_CONFIG[variable.category];
              const Icon = VARIABLE_ICONS[variable.key] || config.icon;
              const isFavorite = favorites.has(variable.key);
              const isUsed = usedVariables.includes(variable.key);
              const isCopied = copiedVariable === variable.key;
              const previewValue = sampleData[variable.key] || variable.exampleValue || "---";

              return (
                <div
                  key={variable.key}
                  className={`group relative p-3 rounded-xl border transition-all hover:shadow-md cursor-pointer ${
                    config.borderColor
                  } ${config.bgColor} hover:${config.borderColor}`}
                  onClick={() => handleInsertVariable(variable.key)}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-2 rounded-lg bg-white shadow-sm ${config.borderColor} border`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {variable.label}
                          </p>
                          <code className="inline-block text-xs font-mono text-slate-600 mt-0.5">
                            {`{{${variable.key}}}`}
                          </code>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(variable.key);
                            }}
                            className="p-1.5 hover:bg-white rounded-lg transition-colors"
                            title="Copy to clipboard"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-slate-500" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(variable.key);
                            }}
                            className="p-1.5 hover:bg-white rounded-lg transition-colors"
                            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Star
                              className={`h-3.5 w-3.5 transition-colors ${
                                isFavorite ? "fill-amber-400 text-amber-400" : "text-slate-400"
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      {variable.description && (
                        <p className="text-xs text-slate-600 mb-2">
                          {variable.description}
                        </p>
                      )}

                      {/* Preview */}
                      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {previewValue}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 mt-2">
                        {isUsed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                            <Check className="h-3 w-3" />
                            In use
                          </span>
                        )}
                        {recentlyUsed.includes(variable.key) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            <Clock className="h-3 w-3" />
                            Recent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Tips */}
      <div className="px-4 py-3 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-1 h-12 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-900">Quick Tips</p>
            <p className="text-xs text-slate-600">• Click to insert • Copy with icon • Star your favorites</p>
            <p className="text-xs text-slate-500">Variables update live with your sample data</p>
          </div>
        </div>
      </div>
    </div>
  );
}