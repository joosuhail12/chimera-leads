"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import type { VariableDefinition } from "@/lib/email/variable-parser";

interface SimpleVariableAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  variables?: VariableDefinition[];
  sampleData?: Record<string, string>;
  placeholder?: string;
  className?: string;
  rows?: number;
}

export function SimpleVariableAutocomplete({
  value,
  onChange,
  variables = [],
  sampleData = {},
  placeholder = "Type {{ to insert variables",
  className = "",
  rows = 3,
}: SimpleVariableAutocompleteProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [caretPosition, setCaretPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter variables based on search
  const filteredVariables = searchTerm
    ? variables.filter(
        (v) =>
          v.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : variables;

  // Handle textarea changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;

    onChange(newValue);
    setCaretPosition(cursorPos);

    // Check for {{ trigger
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastOpenBrace = textBeforeCursor.lastIndexOf("{{");

    if (lastOpenBrace !== -1) {
      const textAfterBrace = textBeforeCursor.substring(lastOpenBrace + 2);
      // Check if we haven't closed the braces yet
      if (!textAfterBrace.includes("}}")) {
        setSearchTerm(textAfterBrace);
        setShowDropdown(true);
        setSelectedIndex(0);
        return;
      }
    }

    // Hide dropdown if no trigger found
    setShowDropdown(false);
    setSearchTerm("");
  };

  // Insert variable at cursor position
  const insertVariable = (variable: VariableDefinition) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart || 0;
    const textBefore = value.substring(0, start);
    const textAfter = value.substring(start);

    // Find where {{ starts
    const lastOpenBrace = textBefore.lastIndexOf("{{");
    if (lastOpenBrace === -1) return;

    // Replace from {{ to cursor with the full variable
    const beforeVariable = value.substring(0, lastOpenBrace);
    const newValue = `${beforeVariable}{{${variable.key}}}${textAfter}`;

    onChange(newValue);
    setShowDropdown(false);
    setSearchTerm("");

    // Set cursor position after the inserted variable
    setTimeout(() => {
      const newPosition = lastOpenBrace + variable.key.length + 4; // +4 for {{}}
      textarea.setSelectionRange(newPosition, newPosition);
      textarea.focus();
    }, 0);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredVariables.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredVariables.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredVariables.length - 1
        );
        break;
      case "Enter":
      case "Tab":
        if (showDropdown && filteredVariables[selectedIndex]) {
          e.preventDefault();
          insertVariable(filteredVariables[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowDropdown(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
      />

      {/* Variable Dropdown */}
      {showDropdown && filteredVariables.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-white rounded-lg shadow-lg border border-slate-200"
        >
          <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2">
            <p className="text-xs text-slate-600">
              {searchTerm ? `Searching: "${searchTerm}"` : "Select a variable"}
            </p>
          </div>

          <div className="py-1">
            {filteredVariables.map((variable, index) => {
              const isSelected = index === selectedIndex;
              const preview = sampleData[variable.key] || variable.exampleValue || "---";

              return (
                <button
                  key={variable.key}
                  type="button"
                  className={`w-full px-3 py-2 text-left hover:bg-slate-50 ${
                    isSelected ? "bg-slate-100" : ""
                  }`}
                  onClick={() => insertVariable(variable)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {variable.label}
                        </span>
                        <code className="text-xs text-slate-500">
                          {`{{${variable.key}}}`}
                        </code>
                      </div>
                      {variable.description && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {variable.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <ChevronRight className="h-3 w-3" />
                      <span className="max-w-[100px] truncate">{preview}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-600">
              <kbd className="px-1 py-0.5 bg-white rounded border border-slate-300">↑↓</kbd> Navigate
              {" "}
              <kbd className="px-1 py-0.5 bg-white rounded border border-slate-300">Enter</kbd> Insert
              {" "}
              <kbd className="px-1 py-0.5 bg-white rounded border border-slate-300">Esc</kbd> Close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}