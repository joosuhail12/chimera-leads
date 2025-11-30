/**
 * Email Accessibility Checker
 * Validates email templates for accessibility issues specific to email clients
 */

import type { TReaderBlock, TReaderDocument } from "@usewaypoint/email-builder";

export type AccessibilityIssueType =
  | "alt-text"
  | "contrast"
  | "heading-hierarchy"
  | "link-text"
  | "font-size"
  | "color-only";

export interface AccessibilityIssue {
  id: string;
  type: AccessibilityIssueType;
  blockId: string;
  blockType: string;
  severity: "critical" | "serious" | "moderate";
  title: string;
  message: string;
  wcagLevel?: "A" | "AA" | "AAA";
  suggestion?: string;
}

export interface AccessibilityReport {
  score: number; // 0-100
  issues: AccessibilityIssue[];
  stats: {
    critical: number;
    serious: number;
    moderate: number;
  };
  passedChecks: string[];
}

/**
 * Calculate relative luminance for WCAG contrast calculations
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getLuminance(hexColor: string): number {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Apply gamma correction
  const rs = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const gs = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const bs = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio from 1 (no contrast) to 21 (maximum contrast)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG standards
 */
export function meetsContrastRequirement(
  ratio: number,
  fontSize: number,
  isBold: boolean,
  level: "AA" | "AAA"
): boolean {
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);

  if (level === "AA") {
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
  } else {
    // AAA
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }
}

/**
 * Check alt text for images
 */
function checkAltText(
  document: TReaderDocument,
  blockId: string,
  block: TReaderBlock
): AccessibilityIssue[] {
  if (block.type !== "Image") return [];

  const issues: AccessibilityIssue[] = [];
  const props = (block.data?.props ?? {}) as Record<string, unknown>;
  const alt = props.alt as string | undefined;

  // Missing alt text
  if (!alt || alt.trim() === "") {
    issues.push({
      id: `${blockId}-missing-alt`,
      type: "alt-text",
      blockId,
      blockType: block.type,
      severity: "critical",
      title: "Missing alt text",
      message: "This image is missing alternative text. Screen readers won't be able to describe it to visually impaired users.",
      wcagLevel: "A",
      suggestion: "Add descriptive alt text that explains what the image shows or its purpose in the email.",
    });
  }
  // Alt text too short (likely not descriptive enough)
  else if (alt.trim().length < 5) {
    issues.push({
      id: `${blockId}-short-alt`,
      type: "alt-text",
      blockId,
      blockType: block.type,
      severity: "moderate",
      title: "Alt text too brief",
      message: `Alt text "${alt}" is very short. Consider adding more detail.`,
      wcagLevel: "A",
      suggestion: "Use at least 5-10 words to describe the image content or purpose.",
    });
  }
  // Alt text with filename patterns
  else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(alt)) {
    issues.push({
      id: `${blockId}-filename-alt`,
      type: "alt-text",
      blockId,
      blockType: block.type,
      severity: "serious",
      title: "Alt text contains filename",
      message: `Alt text "${alt}" appears to be a filename. This isn't helpful to screen reader users.`,
      wcagLevel: "A",
      suggestion: "Replace the filename with a description of what the image shows.",
    });
  }

  return issues;
}

/**
 * Check color contrast for text blocks
 */
function checkContrast(
  document: TReaderDocument,
  blockId: string,
  block: TReaderBlock
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const blockData = block.data as Record<string, unknown> | undefined;
  const style = (blockData && 'style' in blockData ? blockData.style : {}) as Record<string, unknown>;

  // Only check blocks with text
  if (!["Heading", "Text", "Button", "List", "Callout", "Testimonial"].includes(block.type)) {
    return [];
  }

  const textColor = style.color as string | undefined;
  const backgroundColor = style.backgroundColor as string | undefined;
  const fontSize = (style.fontSize as number | undefined) ?? 16;
  const isBold = style.fontWeight === "bold";

  // Need both colors to check contrast
  if (!textColor || !backgroundColor) {
    return [];
  }

  // Validate hex color format
  const isValidHex = (color: string) => /^#[0-9A-F]{6}$/i.test(color);
  if (!isValidHex(textColor) || !isValidHex(backgroundColor)) {
    return [];
  }

  try {
    const ratio = getContrastRatio(textColor, backgroundColor);
    const meetsAA = meetsContrastRequirement(ratio, fontSize, isBold, "AA");

    if (!meetsAA) {
      issues.push({
        id: `${blockId}-contrast`,
        type: "contrast",
        blockId,
        blockType: block.type,
        severity: "serious",
        title: "Low color contrast",
        message: `Text color ${textColor} on background ${backgroundColor} has contrast ratio ${ratio.toFixed(2)}:1, which doesn't meet WCAG AA standards (need ${fontSize >= 18 || (fontSize >= 14 && isBold) ? "3" : "4.5"}:1).`,
        wcagLevel: "AA",
        suggestion: "Increase contrast between text and background colors. Try a darker text color or lighter background.",
      });
    }
  } catch (error) {
    // Skip contrast check if color parsing fails
    console.warn(`Failed to check contrast for block ${blockId}`, error);
  }

  return issues;
}

/**
 * Check heading hierarchy
 */
function checkHeadingHierarchy(document: TReaderDocument): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const headings: Array<{ blockId: string; level: string; position: number }> = [];

  // Collect all headings in document order
  function collectHeadings(parentId: string, position: number): number {
    const children = getChildren(document, parentId);
    let currentPosition = position;

    for (const childId of children) {
      const block = document[childId];
      if (!block) continue;

      if (block.type === "Heading") {
        const props = (block.data?.props ?? {}) as Record<string, unknown>;
        const level = (props.level as string | undefined) ?? "h2";
        headings.push({ blockId: childId, level, position: currentPosition });
        currentPosition++;
      }

      // Recurse into containers
      if (block.type === "Container") {
        currentPosition = collectHeadings(childId, currentPosition);
      }
    }

    return currentPosition;
  }

  collectHeadings("root", 0);

  // Check for missing h1
  const hasH1 = headings.some((h) => h.level === "h1");
  if (!hasH1 && headings.length > 0) {
    issues.push({
      id: "document-no-h1",
      type: "heading-hierarchy",
      blockId: "root",
      blockType: "EmailLayout",
      severity: "moderate",
      title: "No main heading (H1)",
      message: "Email should have at least one H1 heading for proper structure.",
      wcagLevel: "AAA",
      suggestion: "Add an H1 heading at the top of your email as the main title.",
    });
  }

  // Check for hierarchy skips
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const current = headings[i];

    const prevLevel = parseInt(prev.level.replace("h", ""));
    const currentLevel = parseInt(current.level.replace("h", ""));

    // Skipping heading levels (e.g., h1 → h3)
    if (currentLevel > prevLevel + 1) {
      issues.push({
        id: `${current.blockId}-hierarchy-skip`,
        type: "heading-hierarchy",
        blockId: current.blockId,
        blockType: "Heading",
        severity: "moderate",
        title: "Heading hierarchy skip",
        message: `Heading level skips from ${prev.level.toUpperCase()} to ${current.level.toUpperCase()}. This can confuse screen reader users.`,
        wcagLevel: "AAA",
        suggestion: `Use ${`h${prevLevel + 1}`} instead of ${current.level} to maintain proper hierarchy.`,
      });
    }
  }

  return issues;
}

/**
 * Check link text quality for buttons
 */
function checkLinkText(
  document: TReaderDocument,
  blockId: string,
  block: TReaderBlock
): AccessibilityIssue[] {
  if (block.type !== "Button") return [];

  const issues: AccessibilityIssue[] = [];
  const props = (block.data?.props ?? {}) as Record<string, unknown>;
  const text = (props.text as string | undefined) ?? "";

  const genericPhrases = [
    "click here",
    "here",
    "read more",
    "more",
    "link",
    "this link",
    "download",
  ];

  const lowercaseText = text.toLowerCase().trim();

  if (genericPhrases.includes(lowercaseText)) {
    issues.push({
      id: `${blockId}-generic-link`,
      type: "link-text",
      blockId,
      blockType: block.type,
      severity: "moderate",
      title: "Generic link text",
      message: `Button text "${text}" doesn't describe its destination. Screen reader users often navigate by links alone.`,
      wcagLevel: "A",
      suggestion: "Use descriptive text that explains where the button leads, like 'View pricing' or 'Download the guide'.",
    });
  }

  return issues;
}

/**
 * Check font sizes for readability
 */
function checkFontSize(
  document: TReaderDocument,
  blockId: string,
  block: TReaderBlock
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const blockData = block.data as Record<string, unknown> | undefined;
  const style = (blockData && 'style' in blockData ? blockData.style : {}) as Record<string, unknown>;

  // Only check blocks with text
  if (!["Heading", "Text", "Button", "List", "Callout", "Testimonial"].includes(block.type)) {
    return [];
  }

  const fontSize = style.fontSize as number | undefined;

  if (fontSize && fontSize < 14) {
    issues.push({
      id: `${blockId}-small-font`,
      type: "font-size",
      blockId,
      blockType: block.type,
      severity: "moderate",
      title: "Text too small",
      message: `Font size ${fontSize}px is below the recommended 14px minimum for body text.`,
      wcagLevel: "AAA",
      suggestion: "Increase font size to at least 14px for better readability, especially on mobile devices.",
    });
  }

  return issues;
}

/**
 * Run full accessibility audit on document
 */
export function auditAccessibility(document: TReaderDocument): AccessibilityReport {
  const issues: AccessibilityIssue[] = [];
  const passedChecks: string[] = [];

  // Check heading hierarchy
  const hierarchyIssues = checkHeadingHierarchy(document);
  issues.push(...hierarchyIssues);

  if (hierarchyIssues.length === 0) {
    passedChecks.push("Proper heading hierarchy");
  }

  // Check all blocks
  let imageCount = 0;
  let imagesWithAlt = 0;

  Object.entries(document).forEach(([blockId, block]) => {
    if (blockId === "root") return;

    // Alt text checks
    const altIssues = checkAltText(document, blockId, block);
    issues.push(...altIssues);

    if (block.type === "Image") {
      imageCount++;
      if (altIssues.length === 0) {
        imagesWithAlt++;
      }
    }

    // Contrast checks
    const contrastIssues = checkContrast(document, blockId, block);
    issues.push(...contrastIssues);

    // Link text checks
    const linkIssues = checkLinkText(document, blockId, block);
    issues.push(...linkIssues);

    // Font size checks
    const fontIssues = checkFontSize(document, blockId, block);
    issues.push(...fontIssues);
  });

  if (imageCount > 0 && imagesWithAlt === imageCount) {
    passedChecks.push("All images have alt text");
  }

  // Calculate stats
  const stats = {
    critical: issues.filter((i) => i.severity === "critical").length,
    serious: issues.filter((i) => i.severity === "serious").length,
    moderate: issues.filter((i) => i.severity === "moderate").length,
  };

  // Calculate score (0-100)
  // Critical issues: -20 points each
  // Serious issues: -10 points each
  // Moderate issues: -5 points each
  const deductions = stats.critical * 20 + stats.serious * 10 + stats.moderate * 5;
  const score = Math.max(0, 100 - deductions);

  return {
    score,
    issues,
    stats,
    passedChecks,
  };
}

/**
 * Get accessibility issues for a specific block
 */
export function getBlockAccessibilityIssues(
  document: TReaderDocument,
  blockId: string
): AccessibilityIssue[] {
  const block = document[blockId];
  if (!block) return [];

  const issues: AccessibilityIssue[] = [];

  issues.push(...checkAltText(document, blockId, block));
  issues.push(...checkContrast(document, blockId, block));
  issues.push(...checkLinkText(document, blockId, block));
  issues.push(...checkFontSize(document, blockId, block));

  return issues;
}

// Helper function to get children
function getChildren(document: TReaderDocument, parentId: string): string[] {
  if (parentId === "root") {
    const data = document.root?.data as { childrenIds?: string[] } | undefined;
    return data?.childrenIds ?? [];
  }
  const block = document[parentId];
  const blockData = block?.data as Record<string, unknown> | undefined;
  // Some block types have childrenIds at the top level, others have it in props
  const childrenIds = blockData?.childrenIds as string[] | undefined
    ?? (blockData?.props as { childrenIds?: string[] } | undefined)?.childrenIds;
  return childrenIds ?? [];
}
