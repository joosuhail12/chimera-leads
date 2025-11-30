"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  User,
  Mail,
  Building,
  Calendar,
  Hash,
  Sparkles,
  Settings,
  ChevronRight,
  Search
} from "lucide-react";
import type { VariableDefinition } from "@/lib/email/variable-parser";

interface VariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDefinition[];
  sampleData?: Record<string, string>;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

interface AutocompleteState {
  isOpen: boolean;
  searchTerm: string;
  selectedIndex: number;
  triggerPosition: number;
}

const VARIABLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  firstName: User,
  lastName: User,
  email: Mail,
  company: Building,
  companyName: Building,
  date: Calendar,
  count: Hash,
};

const CATEGORY_COLORS: Record<string, string> = {
  contact: "bg-blue-50 text-blue-600 border-blue-200",
  custom: "bg-purple-50 text-purple-600 border-purple-200",
  campaign: "bg-emerald-50 text-emerald-600 border-emerald-200",
  system: "bg-slate-50 text-slate-600 border-slate-200",
};

export function VariableAutocomplete({
  value,
  onChange,
  variables,
  sampleData = {},
  placeholder = "Type {{ to insert variables",
  className = "",
  multiline = false,
  onBlur,
  onFocus,
}: VariableAutocompleteProps) {
  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    isOpen: false,
    searchTerm: "",
    selectedIndex: 0,
    triggerPosition: -1,
  });

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Filter variables based on search term
  const filteredVariables = autocomplete.searchTerm
    ? variables.filter(
        (v) =>
          v.key.toLowerCase().includes(autocomplete.searchTerm.toLowerCase()) ||
          v.label.toLowerCase().includes(autocomplete.searchTerm.toLowerCase())
      )
    : variables;

  console.log("Autocomplete state:", {
    isOpen: autocomplete.isOpen,
    searchTerm: autocomplete.searchTerm,
    variablesCount: variables.length,
    filteredCount: filteredVariables.length
  });

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current || !autocomplete.isOpen) return;

    const input = inputRef.current;
    const rect = input.getBoundingClientRect();

    // For multiline, we need to estimate cursor position
    // This is a simplified approach - for production, consider using a library
    const lineHeight = parseInt(window.getComputedStyle(input).lineHeight);
    const lines = value.substring(0, autocomplete.triggerPosition).split('\n');
    const currentLine = lines.length - 1;

    const top = rect.top + (multiline ? Math.min(currentLine * lineHeight + 30, rect.height - 20) : rect.height + 4);
    const left = rect.left;

    setDropdownPosition({ top, left });
  }, [autocomplete.isOpen, autocomplete.triggerPosition, value, multiline]);

  // Update dropdown position when it opens or window resizes
  useEffect(() => {
    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition);
    };
  }, [updateDropdownPosition]);

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Check if user typed {{
    const beforeCursor = newValue.substring(0, cursorPosition);
    const lastDoubleBrace = beforeCursor.lastIndexOf("{{");

    console.log("Input change:", { newValue, cursorPosition, beforeCursor, lastDoubleBrace });

    if (lastDoubleBrace !== -1) {
      const afterBrace = beforeCursor.substring(lastDoubleBrace + 2);

      // Check if we're still in a variable context (no closing }})
      if (!afterBrace.includes("}}")) {
        // Open autocomplete
        console.log("Opening autocomplete with search:", afterBrace);
        setAutocomplete({
          isOpen: true,
          searchTerm: afterBrace,
          selectedIndex: 0,
          triggerPosition: lastDoubleBrace,
        });
      } else {
        // Close autocomplete if we've closed the variable
        setAutocomplete(prev => ({ ...prev, isOpen: false }));
      }
    } else {
      // Close autocomplete if no {{ found
      setAutocomplete(prev => ({ ...prev, isOpen: false }));
    }

    onChange(newValue);
  };

  // Handle variable selection
  const insertVariable = (variable: VariableDefinition) => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const beforeTrigger = value.substring(0, autocomplete.triggerPosition);
    const afterCursor = value.substring(input.selectionStart || 0);

    // Remove the partial variable name if any
    const cleanBefore = beforeTrigger;
    const newValue = `${cleanBefore}{{${variable.key}}}${afterCursor}`;

    onChange(newValue);

    // Reset autocomplete
    setAutocomplete({
      isOpen: false,
      searchTerm: "",
      selectedIndex: 0,
      triggerPosition: -1,
    });

    // Set cursor position after the inserted variable
    setTimeout(() => {
      if (input) {
        const newPosition = autocomplete.triggerPosition + variable.key.length + 4; // +4 for {{}}
        input.setSelectionRange(newPosition, newPosition);
        input.focus();
      }
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!autocomplete.isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, filteredVariables.length - 1),
        }));
        break;

      case "ArrowUp":
        e.preventDefault();
        setAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        break;

      case "Enter":
      case "Tab":
        if (filteredVariables.length > 0) {
          e.preventDefault();
          insertVariable(filteredVariables[autocomplete.selectedIndex]);
        }
        break;

      case "Escape":
        e.preventDefault();
        setAutocomplete(prev => ({ ...prev, isOpen: false }));
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setAutocomplete(prev => ({ ...prev, isOpen: false }));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          className={className}
          rows={3}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          className={className}
        />
      )}

      {/* Autocomplete Dropdown */}
      {autocomplete.isOpen && filteredVariables.length > 0 && (
        <div
          ref={dropdownRef}
          className="fixed z-50 w-80 max-h-80 overflow-y-auto bg-white rounded-lg shadow-2xl border border-slate-200"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
          }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">
                  {autocomplete.searchTerm ? `Searching: ${autocomplete.searchTerm}` : "Insert Variable"}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {filteredVariables.length} available
              </span>
            </div>
          </div>

          {/* Variable List */}
          <div className="py-1">
            {filteredVariables.map((variable, index) => {
              const Icon = VARIABLE_ICONS[variable.key] || Sparkles;
              const isSelected = index === autocomplete.selectedIndex;
              const previewValue = sampleData[variable.key] || variable.exampleValue || "---";
              const categoryStyle = CATEGORY_COLORS[variable.category] || CATEGORY_COLORS.system;

              return (
                <div
                  key={variable.key}
                  className={`px-3 py-2 cursor-pointer transition-colors ${
                    isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                  }`}
                  onClick={() => insertVariable(variable)}
                  onMouseEnter={() => setAutocomplete(prev => ({ ...prev, selectedIndex: index }))}
                >
                  <div className="flex items-start gap-2">
                    {/* Icon */}
                    <div className={`flex-shrink-0 p-1.5 rounded border ${categoryStyle}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {variable.label}
                        </p>
                        <code className="text-xs font-mono text-slate-500">
                          {`{{${variable.key}}}`}
                        </code>
                      </div>

                      {variable.description && (
                        <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                          {variable.description}
                        </p>
                      )}

                      {/* Preview */}
                      <div className="flex items-center gap-1 mt-1">
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                        <span className="text-xs text-slate-500 truncate">
                          {previewValue}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300">↑↓</kbd> Navigate
              </span>
              <span className="text-slate-600">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300">Enter</kbd> Insert
              </span>
              <span className="text-slate-600">
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-300">Esc</kbd> Close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}