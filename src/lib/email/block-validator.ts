/**
 * Block Validation System
 * Validates blocks for common issues and provides helpful warnings
 */

import type { TReaderBlock, TReaderDocument } from "@usewaypoint/email-builder";

export type ValidationSeverity = "error" | "warning" | "info";

export interface BlockWarning {
  id: string;
  blockId: string;
  blockType: string;
  severity: ValidationSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

/**
 * Validate a single block and return any warnings
 */
export function validateBlock(block: TReaderBlock, blockId: string): BlockWarning[] {
  const warnings: BlockWarning[] = [];
  const blockData = block.data as Record<string, unknown> | undefined;
  const props = (blockData && 'props' in blockData ? blockData.props : {}) as Record<string, unknown>;
  const style = (blockData && 'style' in blockData ? blockData.style : {}) as Record<string, unknown>;

  switch (block.type) {
    case "Button":
      // Check for missing URL
      if (!props.url || props.url === "" || props.url === "https://") {
        warnings.push({
          id: `${blockId}-no-url`,
          blockId,
          blockType: block.type,
          severity: "warning",
          title: "Button links nowhere",
          message: "This button doesn't have a valid URL. Users won't be able to click it.",
          actionLabel: "Add URL",
        });
      }

      // Check for missing or generic text
      if (!props.text || props.text === "" || props.text === "Call to action") {
        warnings.push({
          id: `${blockId}-generic-text`,
          blockId,
          blockType: block.type,
          severity: "info",
          title: "Generic button text",
          message: "Consider using more specific text like 'View Product' or 'Download Guide'.",
          actionLabel: "Update text",
        });
      }
      break;

    case "Image":
      // Check for missing alt text (accessibility issue)
      if (!props.alt || props.alt === "") {
        warnings.push({
          id: `${blockId}-no-alt`,
          blockId,
          blockType: block.type,
          severity: "error",
          title: "Missing alt text",
          message: "All images must have alt text for accessibility. Describe what's in the image.",
          actionLabel: "Add alt text",
        });
      }

      // Check for missing URL
      if (!props.url || props.url === "" || typeof props.url !== "string") {
        warnings.push({
          id: `${blockId}-no-image`,
          blockId,
          blockType: block.type,
          severity: "warning",
          title: "No image source",
          message: "This image block doesn't have a source URL.",
          actionLabel: "Add image URL",
        });
      }

      // Check for placeholder images
      if (typeof props.url === "string" && props.url.includes("placehold.co")) {
        warnings.push({
          id: `${blockId}-placeholder`,
          blockId,
          blockType: block.type,
          severity: "info",
          title: "Placeholder image detected",
          message: "Remember to replace this placeholder with your actual image before sending.",
        });
      }
      break;

    case "Heading":
      // Check for missing text
      if (!props.text || props.text === "" || props.text === "Add a heading") {
        warnings.push({
          id: `${blockId}-empty-heading`,
          blockId,
          blockType: block.type,
          severity: "warning",
          title: "Empty heading",
          message: "This heading doesn't have any text.",
          actionLabel: "Add text",
        });
      }

      // Check for very long headings
      if (typeof props.text === "string" && props.text.length > 120) {
        warnings.push({
          id: `${blockId}-long-heading`,
          blockId,
          blockType: block.type,
          severity: "info",
          title: "Long heading",
          message: `This heading is ${props.text.length} characters. Consider shortening it to improve readability.`,
        });
      }
      break;

    case "Text":
      // Check for missing text
      if (!props.text || props.text === "") {
        warnings.push({
          id: `${blockId}-empty-text`,
          blockId,
          blockType: block.type,
          severity: "info",
          title: "Empty text block",
          message: "This text block doesn't have any content.",
          actionLabel: "Add content",
        });
      }
      break;

    case "Container":
      // Check for empty containers
      const childrenIds = props.childrenIds as string[] | undefined;
      if (!childrenIds || childrenIds.length === 0) {
        warnings.push({
          id: `${blockId}-empty-container`,
          blockId,
          blockType: block.type,
          severity: "info",
          title: "Empty container",
          message: "This container doesn't have any blocks inside it. Add blocks or remove the container.",
        });
      }
      break;

    case "Html":
      // Check for potentially unsafe HTML
      const contents = props.contents as string | undefined;
      if (contents && typeof contents === "string") {
        if (contents.includes("<script")) {
          warnings.push({
            id: `${blockId}-script-tag`,
            blockId,
            blockType: block.type,
            severity: "error",
            title: "Script tag detected",
            message: "Script tags are not allowed in email HTML. They will be stripped by email clients.",
          });
        }
      }
      break;
  }

  // Check for very small text (readability issue)
  if (style.fontSize && typeof style.fontSize === "number" && style.fontSize < 12) {
    warnings.push({
      id: `${blockId}-small-text`,
      blockId,
      blockType: block.type,
      severity: "warning",
      title: "Text too small",
      message: `Font size ${style.fontSize}px is very small. Consider using at least 14px for body text.`,
    });
  }

  return warnings;
}

/**
 * Validate all blocks in a document
 */
export function validateDocument(document: TReaderDocument): BlockWarning[] {
  const warnings: BlockWarning[] = [];

  // Validate all blocks
  Object.entries(document).forEach(([blockId, block]) => {
    if (blockId === "root") return;
    const blockWarnings = validateBlock(block, blockId);
    warnings.push(...blockWarnings);
  });

  return warnings;
}

/**
 * Get warnings for a specific block
 */
export function getBlockWarnings(
  document: TReaderDocument,
  blockId: string
): BlockWarning[] {
  const block = document[blockId];
  if (!block) return [];

  return validateBlock(block, blockId);
}

/**
 * Count warnings by severity
 */
export function countWarningsBySeverity(warnings: BlockWarning[]): {
  errors: number;
  warnings: number;
  info: number;
} {
  return {
    errors: warnings.filter((w) => w.severity === "error").length,
    warnings: warnings.filter((w) => w.severity === "warning").length,
    info: warnings.filter((w) => w.severity === "info").length,
  };
}

/**
 * Check if document has critical errors
 */
export function hasCriticalErrors(document: TReaderDocument): boolean {
  const warnings = validateDocument(document);
  return warnings.some((w) => w.severity === "error");
}
