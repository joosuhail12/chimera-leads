/**
 * Smart Defaults System
 * Generates contextual placeholder content for blocks based on position and context
 */

import type { TReaderBlock, TReaderDocument } from "@usewaypoint/email-builder";

interface BlockContext {
  position: number;
  totalBlocks: number;
  previousBlock?: TReaderBlock;
  nextBlock?: TReaderBlock;
  isFirstOfType: boolean;
  parentType?: string;
}

/**
 * Analyze the context of where a new block will be inserted
 */
export function getBlockContext(
  document: TReaderDocument,
  parentId: string,
  insertIndex: number
): BlockContext {
  const children = getChildren(document, parentId);
  const totalBlocks = children.length;

  const previousBlock = insertIndex > 0 ? document[children[insertIndex - 1]] : undefined;
  const nextBlock = insertIndex < children.length ? document[children[insertIndex]] : undefined;

  return {
    position: insertIndex,
    totalBlocks,
    previousBlock,
    nextBlock,
    isFirstOfType: !previousBlock,
    parentType: parentId === "root" ? "root" : document[parentId]?.type,
  };
}

/**
 * Get smart defaults for a heading block
 */
export function getHeadingDefaults(context: BlockContext): Partial<TReaderBlock["data"]> {
  const { position, isFirstOfType } = context;

  // First heading in email = hero headline
  if (position === 0 || isFirstOfType) {
    return {
      props: {
        text: "Welcome to our latest update",
        level: "h1",
      },
      style: {
        color: "#0F172A",
        fontSize: 36,
        fontWeight: "bold",
        textAlign: "center",
        padding: { top: 24, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Section heading
  return {
    props: {
      text: "What's new",
      level: "h2",
    },
    style: {
      color: "#0F172A",
      fontSize: 28,
      fontWeight: "bold",
      textAlign: "left",
      padding: { top: 32, bottom: 8, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for a text block
 */
export function getTextDefaults(context: BlockContext): Partial<TReaderBlock["data"]> {
  const { previousBlock } = context;

  // After heading = supporting copy
  if (previousBlock?.type === "Heading") {
    return {
      props: {
        text: "We're excited to share what our team has been working on. Here are the highlights from this month's release.",
        markdown: false,
      },
      style: {
        color: "#475467",
        fontSize: 16,
        textAlign: "left",
        padding: { top: 8, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Default paragraph
  return {
    props: {
      text: "Add your content here. You can use **bold** and *italic* markdown formatting.",
      markdown: true,
    },
    style: {
      color: "#475467",
      fontSize: 16,
      textAlign: "left",
      padding: { top: 16, bottom: 16, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for a button block
 */
export function getButtonDefaults(context: BlockContext): Partial<TReaderBlock["data"]> {
  const { previousBlock, position } = context;

  // After hero content = primary CTA
  if (position <= 2) {
    return {
      props: {
        text: "Get started",
        url: "https://",
        size: "large",
        buttonStyle: "rounded",
        buttonBackgroundColor: "#0369A1",
        buttonTextColor: "#FFFFFF",
        fullWidth: false,
      },
      style: {
        textAlign: "center",
        padding: { top: 8, bottom: 32, left: 24, right: 24 },
      },
    };
  }

  // After text = learn more CTA
  if (previousBlock?.type === "Text") {
    return {
      props: {
        text: "Learn more",
        url: "https://",
        size: "medium",
        buttonStyle: "rounded",
        buttonBackgroundColor: "#0F172A",
        buttonTextColor: "#FFFFFF",
        fullWidth: false,
      },
      style: {
        textAlign: "left",
        padding: { top: 16, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Default CTA
  return {
    props: {
      text: "View details",
      url: "https://",
      size: "medium",
      buttonStyle: "rounded",
      buttonBackgroundColor: "#0F172A",
      buttonTextColor: "#FFFFFF",
      fullWidth: false,
    },
    style: {
      textAlign: "left",
      padding: { top: 16, bottom: 16, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for an image block
 */
export function getImageDefaults(context: BlockContext): Partial<TReaderBlock["data"]> {
  const { previousBlock, position } = context;

  // Hero image
  if (position <= 1) {
    return {
      props: {
        url: "https://placehold.co/600x300/e0f2fe/0369a1?text=Hero+Image",
        alt: "Featured image",
        width: 600,
        height: 300,
      },
      style: {
        textAlign: "center",
        padding: { top: 16, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Feature/content image
  if (previousBlock?.type === "Heading") {
    return {
      props: {
        url: "https://placehold.co/600x200/f8fafc/64748b?text=Feature+Image",
        alt: "Feature illustration",
        width: 600,
        height: 200,
      },
      style: {
        textAlign: "center",
        padding: { top: 16, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Default image
  return {
    props: {
      url: "https://placehold.co/600x250/f1f5f9/94a3b8?text=Image",
      alt: "Descriptive text for accessibility",
      width: 600,
      height: 250,
    },
    style: {
      textAlign: "center",
      padding: { top: 16, bottom: 16, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for a list block
 * Note: List is a custom block type not in the standard library
 */
export function getListDefaults(context: BlockContext): Record<string, unknown> {
  const { previousBlock } = context;

  // After heading = feature list
  if (previousBlock?.type === "Heading") {
    return {
      props: {
        items: [
          "Advanced analytics dashboard",
          "Real-time collaboration tools",
          "Seamless integrations",
        ],
        style: "bullet",
      },
      style: {
        color: "#475467",
        fontSize: 16,
        padding: { top: 8, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Default list
  return {
    props: {
      items: ["First item", "Second item", "Third item"],
      style: "bullet",
    },
    style: {
      color: "#475467",
      fontSize: 16,
      padding: { top: 16, bottom: 16, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for a callout block
 * Note: Callout is a custom block type not in the standard library
 */
export function getCalloutDefaults(context: BlockContext): Record<string, unknown> {
  const { position } = context;

  // Early in email = important announcement
  if (position <= 3) {
    return {
      props: {
        text: "Limited time offer: Get 20% off your first purchase",
        variant: "info",
        icon: "ℹ",
      },
      style: {
        backgroundColor: "#E0F2FE",
        borderColor: "#0369A1",
        color: "#0C4A6E",
        padding: { top: 16, bottom: 16, left: 24, right: 24 },
      },
    };
  }

  // Default callout
  return {
    props: {
      text: "Important: This is a highlighted message",
      variant: "warning",
      icon: "⚠",
    },
    style: {
      backgroundColor: "#FEF3C7",
      borderColor: "#F59E0B",
      color: "#78350F",
      padding: { top: 16, bottom: 16, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for a testimonial block
 * Note: Testimonial is a custom block type not in the standard library
 */
export function getTestimonialDefaults(context: BlockContext): Record<string, unknown> {
  return {
    props: {
      quote: "This product has transformed the way we work. The team is more productive and our customers are happier.",
      author: "Sarah Chen",
      role: "VP of Product at TechCo",
      avatarUrl: "https://placehold.co/64x64/e0f2fe/0369a1?text=SC",
    },
    style: {
      backgroundColor: "#F8FAFC",
      borderColor: "#E2E8F0",
      color: "#0F172A",
      padding: { top: 24, bottom: 24, left: 24, right: 24 },
    },
  };
}

/**
 * Get smart defaults for a container block
 */
export function getContainerDefaults(context: BlockContext): Partial<TReaderBlock["data"]> {
  const { position } = context;

  // Hero container
  if (position === 0) {
    return {
      style: {
        backgroundColor: "#E0F2FE",
        borderRadius: 24,
        padding: { top: 40, bottom: 40, left: 24, right: 24 },
      },
      props: {
        childrenIds: [],
      },
    };
  }

  // Feature container
  return {
    style: {
      backgroundColor: "#F8FAFC",
      borderRadius: 18,
      padding: { top: 24, bottom: 24, left: 24, right: 24 },
    },
    props: {
      childrenIds: [],
    },
  };
}

/**
 * Apply smart defaults to a block based on context
 */
export function applySmartDefaults(
  block: TReaderBlock,
  context: BlockContext
): TReaderBlock {
  let defaults: Record<string, unknown> = {};
  const blockType = block.type as string;

  switch (blockType) {
    case "Heading":
      defaults = getHeadingDefaults(context);
      break;
    case "Text":
      defaults = getTextDefaults(context);
      break;
    case "Button":
      defaults = getButtonDefaults(context);
      break;
    case "Image":
      defaults = getImageDefaults(context);
      break;
    case "List":
      defaults = getListDefaults(context);
      break;
    case "Callout":
      defaults = getCalloutDefaults(context);
      break;
    case "Testimonial":
      defaults = getTestimonialDefaults(context);
      break;
    case "Container":
      defaults = getContainerDefaults(context);
      break;
    default:
      // No smart defaults for other block types
      return block;
  }

  // Merge defaults with existing block data
  const blockData = block.data as Record<string, unknown> | undefined;
  const defaultProps = defaults.props as Record<string, unknown> | undefined;
  const defaultStyle = defaults.style as Record<string, unknown> | undefined;
  const existingProps = blockData?.props as Record<string, unknown> | undefined;
  const existingStyle = blockData?.style as Record<string, unknown> | undefined;

  return {
    ...block,
    data: {
      ...defaults,
      ...block.data,
      props: {
        ...defaultProps,
        ...existingProps,
      },
      style: {
        ...defaultStyle,
        ...existingStyle,
      },
    },
  } as TReaderBlock;
}

/**
 * Check if a block has default/placeholder content
 */
export function hasPlaceholderContent(block: TReaderBlock): boolean {
  const blockData = block.data as Record<string, unknown> | undefined;
  const props = (blockData && 'props' in blockData ? blockData.props : {}) as Record<string, unknown>;

  const placeholderTexts = [
    "Add a heading",
    "Introduce your product",
    "Call to action",
    "Add your content here",
    "Placeholder image",
    "First item",
    "Important:",
    "This product has transformed",
  ];

  const text = String(props.text || props.quote || "");
  return placeholderTexts.some((placeholder) => text.includes(placeholder));
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
