/**
 * Variable Parser for Email Templates
 *
 * Handles extraction, replacement, and validation of variables in email templates.
 * Variables use the syntax: {{variableName}} or {{variableName|default:"fallback"}}
 */

export type VariableCategory = "contact" | "custom" | "campaign" | "system";

export interface VariableDefinition {
  key: string;
  label: string;
  category: VariableCategory;
  defaultValue?: string;
  description?: string;
  exampleValue?: string;
  isRequired?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    variable: string;
    message: string;
    type: "syntax" | "undefined" | "missing_default";
  }>;
  warnings: Array<{
    variable: string;
    message: string;
  }>;
}

/**
 * Regular expression for matching variables
 * Matches: {{variableName}} or {{variableName|default:"fallback value"}}
 */
const VARIABLE_REGEX = /\{\{([a-zA-Z0-9._]+)(?:\|default:"([^"]*)")?\}\}/g;

/**
 * Extract all unique variables from text
 * @param text - Text containing variables
 * @returns Array of unique variable keys
 */
export function extractVariables(text: string): string[] {
  if (!text) return [];

  const matches: string[] = [];
  const regex = new RegExp(VARIABLE_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push(match[1]);
  }

  return [...new Set(matches)];
}

/**
 * Extract variables with their default values
 * @param text - Text containing variables
 * @returns Array of objects with key and defaultValue
 */
export function extractVariablesWithDefaults(
  text: string
): Array<{ key: string; defaultValue?: string }> {
  if (!text) return [];

  const matches: Array<{ key: string; defaultValue?: string }> = [];
  const regex = new RegExp(VARIABLE_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      key: match[1],
      defaultValue: match[2] || undefined,
    });
  }

  return matches;
}

/**
 * Replace variables in text with provided values
 * @param text - Text containing variables
 * @param values - Object mapping variable keys to values
 * @param definitions - Variable definitions for fallback defaults
 * @returns Text with variables replaced
 */
export function replaceVariables(
  text: string,
  values: Record<string, string>,
  definitions: VariableDefinition[] = []
): string {
  if (!text) return text;

  return text.replace(
    VARIABLE_REGEX,
    (match, key, defaultVal) => {
      // First priority: provided value
      if (values[key] !== undefined && values[key] !== null) {
        return values[key];
      }

      // Second priority: inline default value
      if (defaultVal !== undefined) {
        return defaultVal;
      }

      // Third priority: definition default value
      const def = definitions.find((d) => d.key === key);
      if (def?.defaultValue) {
        return def.defaultValue;
      }

      // Fallback: return original syntax (variable not replaced)
      return match;
    }
  );
}

/**
 * Validate variables in text against definitions
 * @param text - Text containing variables
 * @param definitions - Available variable definitions
 * @param requiredVariables - List of required variable keys
 * @returns Validation result with errors and warnings
 */
export function validateVariables(
  text: string,
  definitions: VariableDefinition[],
  requiredVariables: string[] = []
): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (!text) return result;

  // Check for syntax errors (unclosed braces)
  const unclosedBraces = text.match(/\{\{[^}]*$/g);
  if (unclosedBraces) {
    result.valid = false;
    result.errors.push({
      variable: unclosedBraces[0],
      message: "Unclosed variable syntax. Variables must end with }}",
      type: "syntax",
    });
  }

  // Extract variables with defaults
  const variablesWithDefaults = extractVariablesWithDefaults(text);
  const definitionKeys = definitions.map((d) => d.key);

  // Check each variable
  for (const { key, defaultValue } of variablesWithDefaults) {
    // Check if variable is defined
    if (!definitionKeys.includes(key)) {
      result.valid = false;
      result.errors.push({
        variable: key,
        message: `Variable "{{${key}}}" is not defined. Check if it matches a custom field or built-in variable.`,
        type: "undefined",
      });
      continue;
    }

    // Check if required variable has default
    const definition = definitions.find((d) => d.key === key);
    if (definition?.isRequired && !defaultValue && !definition.defaultValue) {
      result.warnings.push({
        variable: key,
        message: `Required variable "{{${key}}}" should have a default value.`,
      });
    }
  }

  // Check if all required variables are present
  const usedVariables = variablesWithDefaults.map((v) => v.key);
  for (const requiredKey of requiredVariables) {
    if (!usedVariables.includes(requiredKey)) {
      result.warnings.push({
        variable: requiredKey,
        message: `Required variable "{{${requiredKey}}}" is not used in the template.`,
      });
    }
  }

  return result;
}

/**
 * Apply variables to a TReaderDocument (for preview)
 * @param doc - Email template document
 * @param sampleData - Sample values for variables
 * @param definitions - Variable definitions
 * @returns New document with variables replaced
 */
export function applyVariablesToDocument(
  doc: Record<string, unknown>,
  sampleData: Record<string, string>,
  definitions: VariableDefinition[] = []
): Record<string, unknown> {
  // Deep clone to avoid mutating original
  const cloned = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  // Recursively process all blocks
  Object.keys(cloned).forEach((blockId) => {
    const block = cloned[blockId] as {
      data?: {
        props?: Record<string, unknown>;
      };
    };

    if (block.data?.props) {
      // Replace variables in all string props
      Object.keys(block.data.props).forEach((propKey) => {
        if (!block.data?.props) return;
        const propValue = block.data.props[propKey];

        if (typeof propValue === "string" && block.data?.props) {
          block.data.props[propKey] = replaceVariables(
            propValue,
            sampleData,
            definitions
          );
        }
      });
    }
  });

  return cloned;
}

/**
 * Check if text contains variables
 * @param text - Text to check
 * @returns True if text contains at least one variable
 */
export function hasVariables(text: string): boolean {
  if (!text) return false;
  return VARIABLE_REGEX.test(text);
}

/**
 * Count variables in text
 * @param text - Text to analyze
 * @returns Number of variable occurrences (not unique)
 */
export function countVariables(text: string): number {
  if (!text) return 0;
  const matches = text.match(VARIABLE_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Escape variable syntax to render literal braces
 * @param text - Text containing variables to escape
 * @returns Text with escaped braces
 */
export function escapeVariables(text: string): string {
  if (!text) return text;
  return text.replace(/\{\{/g, "\\{\\{");
}

/**
 * Unescape variable syntax
 * @param text - Text with escaped braces
 * @returns Text with unescaped braces
 */
export function unescapeVariables(text: string): string {
  if (!text) return text;
  return text.replace(/\\{\\{/g, "{{");
}

/**
 * Get default sample data for common variables
 * @returns Object with sample values
 */
export function getDefaultSampleData(): Record<string, string> {
  return {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    company: "Acme Corporation",
    "custom.companyName": "Acme Corporation",
    "custom.industry": "Technology",
    "custom.website": "https://example.com",
    "campaign.name": "Spring Sale 2025",
    "campaign.sendDate": new Date().toLocaleDateString(),
    unsubscribeUrl: "https://example.com/unsubscribe?token=abc123",
    preferencesUrl: "https://example.com/preferences?token=abc123",
  };
}
