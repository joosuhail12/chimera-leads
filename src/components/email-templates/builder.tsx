"use client";

import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { MouseEvent } from "react";
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Tablet,
  Eye,
  X,
  Undo,
  Redo,
  Save,
  Copy,
  Trash2,
  Settings,
  Plus,
  Layers,
  Type,
  Image as ImageIcon,
  Layout,
  Minus,
  Code,
  Share2,
  Video,
  Star,
  Zap,
  BarChart,
  LayoutTemplate,
  Download,
} from "lucide-react";
import { renderToStaticMarkup, type TReaderBlock, type TReaderDocument, Reader } from "@usewaypoint/email-builder";
import type { EmailTemplate } from "./manager";
import { SubjectPreheaderWithAutocomplete } from "./subject-preheader-with-autocomplete";
import { EnhancedVariableLibrary } from "./enhanced-variable-library";
import { SimpleVariableAutocomplete } from "./simple-variable-autocomplete";
import {
  extractVariables,
  applyVariablesToDocument,
  getDefaultSampleData,
  type VariableDefinition,
} from "@/lib/email/variable-parser";
import { createListBlock, ListInspector, type ListBlock } from "./blocks/list-block";
import { createCalloutBlock, CalloutInspector, type CalloutBlock } from "./blocks/callout-block";
import { createTestimonialBlock, TestimonialInspector, type TestimonialBlock } from "./blocks/testimonial-block";
import { createTwoColumnBlock, TwoColumnInspector, type TwoColumnBlock } from "./blocks/two-column-block";
import { OnboardingTour } from "./onboarding-tour";
import { getBlockWarnings, validateDocument, countWarningsBySeverity, type BlockWarning } from "@/lib/email/block-validator";
import { WarningsPanel, WarningsBadge } from "./warnings-panel";
import { getBlockContext, applySmartDefaults } from "@/lib/email/smart-defaults";
import { auditAccessibility, getBlockAccessibilityIssues, type AccessibilityIssue } from "@/lib/email/accessibility-checker";
import { AccessibilityPanel, AccessibilityBadge } from "./accessibility-panel";

type BuilderProps = {
  template?: EmailTemplate | null;
  onSaved?: (template: EmailTemplate) => void;
};

type PresetDefinition =
  | { rootId: string; nodes: Record<string, TReaderBlock> }
  | TReaderBlock[];

type PresetFactory = () => PresetDefinition;

type BlockLibraryItem =
  | {
    id: string;
    kind: "block";
    type: TReaderBlock["type"];
    label: string;
    description: string;
    icon: string;
    tags?: string[];
    category?: string;
    createBlock: () => TReaderBlock;
  }
  | {
    id: string;
    kind: "preset";
    label: string;
    description: string;
    icon: string;
    tags?: string[];
    category?: string;
    createPreset: PresetFactory;
  };

type InspectorProps = {
  block: TReaderBlock;
  activeTab: InspectorTab;
  onChange: (updater: (prev: TReaderBlock) => TReaderBlock) => void;
  variables?: {
    builtIn: VariableDefinition[];
    customFields: VariableDefinition[];
    campaign: VariableDefinition[];
    system: VariableDefinition[];
  };
  sampleData?: Record<string, string>;
};

type ColorInputFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string | null) => void;
};

type LoosePadding = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

type LooseStyle = {
  padding?: LoosePadding;
  textAlign?: "left" | "center" | "right";
  fontSize?: number;
  fontWeight?: "bold" | "normal";
  borderRadius?: number | null;
  borderColor?: string | null;
  color?: string | null;
  backgroundColor?: string | null;
  [key: string]: unknown;
};

type LooseProps = Record<string, unknown>;

type EmailLayoutSettings = {
  backdropColor?: string | null;
  canvasColor?: string | null;
  textColor?: string | null;
  borderColor?: string | null;
  borderRadius?: number | null;
  fontFamily?: string | null;
  childrenIds?: string[];
};

type BlockDataPayload = NonNullable<TReaderBlock["data"]>;
type BlockStylePayload = NonNullable<BlockDataPayload["style"]>;
type BlockPropsPayload = NonNullable<BlockDataPayload["props"]>;

type ParentNodeId = "root" | string;

type HistoryEntry = {
  configuration: TReaderDocument;
  name: string;
  description: string;
  selectedBlockId: string | null;
};

type AutosaveSnapshot = HistoryEntry & { updatedAt: number };

type HistoryStats = {
  cursor: number;
  total: number;
};

const DEFAULT_PADDING = {
  top: 16,
  bottom: 16,
  left: 24,
  right: 24,
};

const FONT_OPTIONS = [
  { value: "MODERN_SANS", label: "Modern sans" },
  { value: "BOOK_SANS", label: "Book sans" },
  { value: "ORGANIC_SANS", label: "Organic sans" },
  { value: "GEOMETRIC_SANS", label: "Geometric sans" },
  { value: "HEAVY_SANS", label: "Heavy sans" },
  { value: "ROUNDED_SANS", label: "Rounded sans" },
  { value: "MODERN_SERIF", label: "Modern serif" },
  { value: "BOOK_SERIF", label: "Book serif" },
  { value: "MONOSPACE", label: "Monospace" },
] as const;

const HISTORY_LIMIT = 40;
const AUTOSAVE_INTERVAL_MS = 800;
const AUTOSAVE_KEY_PREFIX = "chimera:email-builder:";
const CHILD_SUPPORTED_TYPES = new Set(["Container"]);
const FAVORITES_STORAGE_KEY = "chimera:email-builder:favorites";
const RECENTLY_USED_STORAGE_KEY = "chimera:email-builder:recently-used";
const RECENTLY_USED_LIMIT = 6;

const SUPPORTED_BLOCK_TYPES = new Set([
  "EmailLayout",
  "Container",
  "Avatar",
  "Button",
  "Divider",
  "Heading",
  "Html",
  "Image",
  "Spacer",
  "Text",
  "List",
  "Callout",
  "Testimonial",
]);

const DEFAULT_DOCUMENT: TReaderDocument = createDefaultDocument();

const GLOBAL_STYLE_DEFAULTS = {
  backdropColor: "#F4F4F5",
  canvasColor: "#FFFFFF",
  textColor: "#0F172A",
  borderColor: "#E2E8F0",
  borderRadius: 18,
  fontFamily: "MODERN_SANS",
} as const;

const PREVIEW_MODES = [
  { id: "desktop", label: "Desktop", width: 720 },
  { id: "tablet", label: "Tablet", width: 560 },
  { id: "mobile", label: "Mobile", width: 380 },
] as const;

const INSPECTOR_TABS = [
  { id: "content", label: "Content" },
  { id: "style", label: "Style" },
  { id: "spacing", label: "Spacing" },
] as const;

const HOTKEY_BLOCKS: Record<string, TReaderBlock["type"]> = {
  KeyH: "Heading",
  KeyT: "Text",
  KeyB: "Button",
  KeyI: "Image",
  KeyC: "Container",
  KeyD: "Divider",
};

type PreviewModeId = (typeof PREVIEW_MODES)[number]["id"];
type InspectorTab = (typeof INSPECTOR_TABS)[number]["id"];

const PREVIEW_ICON_MAP: Record<PreviewModeId, React.ComponentType<{ className?: string }>> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

const THEME_PRESETS = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Neutral canvas with dark text",
    tokens: {
      backdropColor: "#F4F4F5",
      canvasColor: "#FFFFFF",
      textColor: "#0F172A",
      borderColor: "#E2E8F0",
      borderRadius: 18,
      fontFamily: "MODERN_SANS",
    },
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Dark shell with accent canvas",
    tokens: {
      backdropColor: "#020617",
      canvasColor: "#0F172A",
      textColor: "#E2E8F0",
      borderColor: "#1E293B",
      borderRadius: 24,
      fontFamily: "GEOMETRIC_SANS",
    },
  },
  {
    id: "brand-sunrise",
    label: "Sunrise",
    description: "Warm gradients with rounded corners",
    tokens: {
      backdropColor: "#FFF7ED",
      canvasColor: "#FFFBEB",
      textColor: "#7C2D12",
      borderColor: "#FDBA74",
      borderRadius: 32,
      fontFamily: "ORGANIC_SANS",
    },
  },
] as const;

// ... (Previous imports remain the same)

// ... (Types and Constants remain the same until BLOCK_LIBRARY)

const BLOCK_LIBRARY: BlockLibraryItem[] = [
  // BASIC BLOCKS
  {
    id: "heading-block",
    kind: "block",
    type: "Heading",
    label: "Heading",
    description: "Hero or section titles",
    icon: "H1",
    tags: ["text", "title", "headline"],
    category: "Basic",
    createBlock: createHeadingBlock,
  },
  {
    id: "text-block",
    kind: "block",
    type: "Text",
    label: "Paragraph",
    description: "Long-form body copy",
    icon: "TXT",
    tags: ["text", "content", "body"],
    category: "Basic",
    createBlock: createTextBlock,
  },
  {
    id: "button-block",
    kind: "block",
    type: "Button",
    label: "Button",
    description: "Primary calls-to-action",
    icon: "BTN",
    tags: ["cta", "action", "link"],
    category: "Basic",
    createBlock: createButtonBlock,
  },
  {
    id: "image-block",
    kind: "block",
    type: "Image",
    label: "Image",
    description: "Screenshots, logos, artwork",
    icon: "IMG",
    tags: ["media", "visual", "photo"],
    category: "Media",
    createBlock: createImageBlock,
  },

  // LAYOUT BLOCKS
  {
    id: "container-block",
    kind: "block",
    type: "Container",
    label: "Section",
    description: "Nest blocks inside a styled wrapper",
    icon: "LAY",
    tags: ["layout", "wrapper", "group"],
    category: "Layout",
    createBlock: createContainerBlock,
  },
  {
    id: "divider-block",
    kind: "block",
    type: "Divider",
    label: "Divider",
    description: "Subtle separators",
    icon: "---",
    tags: ["separator", "line", "spacing"],
    category: "Layout",
    createBlock: createDividerBlock,
  },
  {
    id: "spacer-block",
    kind: "block",
    type: "Spacer",
    label: "Spacer",
    description: "Custom vertical spacing",
    icon: "SPC",
    tags: ["spacing", "gap", "padding"],
    category: "Layout",
    createBlock: createSpacerBlock,
  },

  // ADVANCED BLOCKS
  {
    id: "html-block",
    kind: "block",
    type: "Html",
    label: "Raw HTML",
    description: "Embed custom markup",
    icon: "<>",
    tags: ["custom", "code", "advanced"],
    category: "Advanced",
    createBlock: createHtmlBlock,
  },
  {
    id: "list-block",
    kind: "block",
    type: "List",
    label: "List",
    description: "Bullet or numbered lists",
    icon: "☰",
    tags: ["list", "items", "bullets"],
    category: "Basic",
    createBlock: createListBlock,
  },

  // ENGAGEMENT BLOCKS
  {
    id: "callout-block",
    kind: "block",
    type: "Callout",
    label: "Callout",
    description: "Important alerts and tips",
    icon: "⚠",
    tags: ["alert", "notice", "highlight"],
    category: "Engagement",
    createBlock: createCalloutBlock,
  },
  {
    id: "testimonial-block",
    kind: "block",
    type: "Testimonial",
    label: "Testimonial",
    description: "Customer quotes with author",
    icon: "💬",
    tags: ["quote", "review", "social-proof"],
    category: "Engagement",
    createBlock: createTestimonialBlock,
  },

  // PRESETS
  {
    id: "two-column-block",
    kind: "preset",
    label: "Two Columns",
    description: "Side-by-side layout",
    icon: "▐▌",
    tags: ["layout", "columns", "grid"],
    category: "Layout",
    createPreset: createTwoColumnBlock,
  },
  {
    id: "preset-social",
    kind: "preset",
    label: "Social links",
    description: "Row of social media icons",
    icon: "SOC",
    tags: ["social", "icons", "footer"],
    category: "Components",
    createPreset: createSocialLinksPreset,
  },
  {
    id: "preset-video",
    kind: "preset",
    label: "Video",
    description: "Video thumbnail with play button",
    icon: "VID",
    tags: ["media", "video", "youtube"],
    category: "Media",
    createPreset: createVideoPreset,
  },
  {
    id: "preset-hero",
    kind: "preset",
    label: "Hero preset",
    description: "Eyebrow, headline, subcopy, and CTA button",
    icon: "⭐",
    tags: ["hero", "header", "announcement"],
    category: "Components",
    createPreset: createHeroPreset,
  },
  {
    id: "preset-feature",
    kind: "preset",
    label: "Feature spotlight",
    description: "Image with supporting copy and CTA",
    icon: "⚡",
    tags: ["feature", "product", "showcase"],
    category: "Components",
    createPreset: createFeaturePreset,
  },
  {
    id: "preset-metrics",
    kind: "preset",
    label: "Metrics row",
    description: "Three-column stat blocks for social proof",
    icon: "◆",
    tags: ["stats", "metrics", "numbers"],
    category: "Components",
    createPreset: createMetricsPreset,
  },
  {
    id: "preset-footer",
    kind: "preset",
    label: "Footer",
    description: "Address, unsubscribe, and branding",
    icon: "FTR",
    tags: ["footer", "legal", "unsubscribe"],
    category: "Components",
    createPreset: createFooterPreset,
  },
];

const BLOCK_META: Record<string, { label: string; description: string }> = BLOCK_LIBRARY.reduce(
  (acc, item) => {
    if (item.kind === "block") {
      acc[item.type] = { label: item.label, description: item.description };
    }
    return acc;
  },
  {
    EmailLayout: {
      label: "Email layout",
      description: "Canvas, typography, borders",
    },
  } as Record<string, { label: string; description: string }>
);

const BLOCK_CATEGORIES = Array.from(
  new Set(
    BLOCK_LIBRARY.map((item) => item.category).filter((cat): cat is string => Boolean(cat))
  )
).sort();

export function EmailTemplateBuilder({ template, onSaved }: BuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [autosaveMessage, setAutosaveMessage] = useState("Draft saved");
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historyStats, setHistoryStats] = useState<HistoryStats>({ cursor: -1, total: 0 });
  const [previewMode, setPreviewMode] = useState<PreviewModeId>("desktop");
  const [blockSearch, setBlockSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [recentlyUsedIds, setRecentlyUsedIds] = useState<string[]>([]);
  const [recentlyUsedLoaded, setRecentlyUsedLoaded] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("content");
  const [activeLeftTab, setActiveLeftTab] = useState<"insert" | "layers" | "variables">("insert");
  const [activeRightTab, setActiveRightTab] = useState<"settings" | "styles" | "accessibility">("settings");
  const [isPending, startTransition] = useTransition();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() =>
    template?.updated_at ? Date.parse(template.updated_at) : null
  );
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  // Phase 1: Subject line, preheader, and variable system
  const [subjectLine, setSubjectLine] = useState(template?.subject_line || "");
  const [preheaderText, setPreheaderText] = useState(template?.preheader_text || "");
  const [availableVariables, setAvailableVariables] = useState<{
    builtIn: VariableDefinition[];
    customFields: VariableDefinition[];
    campaign: VariableDefinition[];
    system: VariableDefinition[];
  } | null>(null);
  const [sampleData, setSampleData] = useState<Record<string, string>>(
    getDefaultSampleData()
  );
  const [previewWithSampleData, setPreviewWithSampleData] = useState(true);

  const [configuration, setConfiguration] = useState<TReaderDocument>(() =>
    prepareInitialDocument(template)
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => {
    const doc = prepareInitialDocument(template);
    const children = getChildren(doc, "root");
    return children[0] ?? null;
  });

  const autosaveKey = useMemo(
    () => `${AUTOSAVE_KEY_PREFIX}${template?.id ?? "new"}`,
    [template?.id]
  );

  // Extract all variables used in the template
  const usedVariables = useMemo(() => {
    const docStr = JSON.stringify(configuration);
    const subjectVars = extractVariables(subjectLine);
    const preheaderVars = extractVariables(preheaderText);
    const docVars = extractVariables(docStr);

    return [...subjectVars, ...preheaderVars, ...docVars];
  }, [configuration, subjectLine, preheaderText]);

  // Validate blocks and get warnings
  const currentBlockWarnings = useMemo(() => {
    if (!selectedBlockId) return [];
    return getBlockWarnings(configuration, selectedBlockId);
  }, [configuration, selectedBlockId]);

  const allDocumentWarnings = useMemo(() => {
    return validateDocument(configuration);
  }, [configuration]);

  const warningCounts = useMemo(() => {
    return countWarningsBySeverity(allDocumentWarnings);
  }, [allDocumentWarnings]);

  // Accessibility checks
  const accessibilityReport = useMemo(() => {
    return auditAccessibility(configuration);
  }, [configuration]);

  const currentBlockA11yIssues = useMemo(() => {
    if (!selectedBlockId) return [];
    return getBlockAccessibilityIssues(configuration, selectedBlockId);
  }, [configuration, selectedBlockId]);

  const historyRef = useRef<HistoryEntry[]>([]);
  const historyCursorRef = useRef(-1);
  const lastSnapshotRef = useRef<string>("");
  const isRestoringRef = useRef(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addBlockRef = useRef(handleAddBlock);

  useEffect(() => {
    addBlockRef.current = handleAddBlock;
  });

  const syncHistoryState = useCallback(() => {
    setHistoryStats({
      cursor: historyCursorRef.current,
      total: historyRef.current.length,
    });
    setCanUndo(historyCursorRef.current > 0);
    setCanRedo(historyCursorRef.current < historyRef.current.length - 1);
  }, []);

  const loadTemplateState = useCallback(() => {
    const doc = prepareInitialDocument(template);
    setConfiguration(doc);
    const children = getChildren(doc, "root");
    const initialSelected = children[0] ?? null;
    setSelectedBlockId(initialSelected);
    const nextName = template?.name ?? "";
    const nextDescription = template?.description ?? "";
    setName(nextName);
    setDescription(nextDescription);
    const initialEntry: HistoryEntry = {
      configuration: deepCloneDocument(doc),
      name: nextName,
      description: nextDescription,
      selectedBlockId: initialSelected,
    };
    historyRef.current = [initialEntry];
    historyCursorRef.current = 0;
    lastSnapshotRef.current = JSON.stringify({
      configuration: doc,
      name: nextName,
      description: nextDescription,
    });
    setStatusMessage(null);
    setHasLocalDraft(false);
    syncHistoryState();
  }, [template, syncHistoryState]);

  useEffect(() => {
    loadTemplateState();
  }, [loadTemplateState]);

  useEffect(() => {
    setLastSyncedAt(template?.updated_at ? Date.parse(template.updated_at) : null);
  }, [template?.updated_at]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setFavoriteIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch (error) {
      console.warn("Failed to load favorite blocks", error);
    } finally {
      setFavoritesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesLoaded || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
    } catch (error) {
      console.warn("Failed to persist favorites", error);
    }
  }, [favoriteIds, favoritesLoaded]);

  // Load recently used blocks
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(RECENTLY_USED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentlyUsedIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch (error) {
      console.warn("Failed to load recently used blocks", error);
    } finally {
      setRecentlyUsedLoaded(true);
    }
  }, []);

  // Save recently used blocks
  useEffect(() => {
    if (!recentlyUsedLoaded || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RECENTLY_USED_STORAGE_KEY, JSON.stringify(recentlyUsedIds));
    } catch (error) {
      console.warn("Failed to persist recently used blocks", error);
    }
  }, [recentlyUsedIds, recentlyUsedLoaded]);

  // Fetch available variables when template loads
  useEffect(() => {
    if (template?.id) {
      fetch(`/api/email-templates/${template.id}/variables`)
        .then((res) => res.json())
        .then((data) => {
          setAvailableVariables(data.variables);
        })
        .catch((err) => {
          console.error("Failed to fetch variables:", err);
          // Set default variables on error
          setAvailableVariables({
            builtIn: [
              {
                key: "firstName",
                label: "First Name",
                category: "contact",
                defaultValue: "there",
                description: "Recipient's first name",
                exampleValue: "John",
              },
              {
                key: "lastName",
                label: "Last Name",
                category: "contact",
                defaultValue: "",
                description: "Recipient's last name",
                exampleValue: "Doe",
              },
              {
                key: "email",
                label: "Email",
                category: "contact",
                defaultValue: "",
                description: "Recipient's email",
                exampleValue: "john@example.com",
              },
            ],
            customFields: [],
            campaign: [],
            system: [],
          });
        });

      // Load saved sample data from localStorage
      try {
        const stored = localStorage.getItem(`template-${template.id}-sample-data`);
        if (stored) {
          setSampleData(JSON.parse(stored));
        }
      } catch {
        // Use defaults
      }
    } else {
      // For new templates without ID, provide default variables
      setAvailableVariables({
        builtIn: [
          {
            key: "firstName",
            label: "First Name",
            category: "contact",
            defaultValue: "there",
            description: "Recipient's first name",
            exampleValue: "John",
          },
          {
            key: "lastName",
            label: "Last Name",
            category: "contact",
            defaultValue: "",
            description: "Recipient's last name",
            exampleValue: "Doe",
          },
          {
            key: "email",
            label: "Email",
            category: "contact",
            defaultValue: "",
            description: "Recipient's email",
            exampleValue: "john@example.com",
          },
        ],
        customFields: [],
        campaign: [],
        system: [],
      });
    }
  }, [template?.id]);

  // Save sample data to localStorage when it changes
  useEffect(() => {
    if (template?.id) {
      localStorage.setItem(
        `template-${template.id}-sample-data`,
        JSON.stringify(sampleData)
      );
    }
  }, [sampleData, template?.id]);

  useEffect(() => {
    const snapshot = JSON.stringify({ configuration, name, description });
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === lastSnapshotRef.current) return;

    const truncated = historyRef.current.slice(0, historyCursorRef.current + 1);
    truncated.push({
      configuration: deepCloneDocument(configuration),
      name,
      description,
      selectedBlockId,
    });
    if (truncated.length > HISTORY_LIMIT) {
      truncated.shift();
    }
    historyRef.current = truncated;
    historyCursorRef.current = truncated.length - 1;
    lastSnapshotRef.current = snapshot;
    syncHistoryState();
  }, [configuration, name, description, selectedBlockId, syncHistoryState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(autosaveKey);
    if (!raw) {
      setHasLocalDraft(false);
      return;
    }
    setHasLocalDraft(true);
    try {
      const parsed = JSON.parse(raw) as AutosaveSnapshot;
      if (!parsed?.configuration) return;
      isRestoringRef.current = true;
      const sanitized = sanitizeDocument(deepCloneDocument(parsed.configuration));
      setConfiguration(sanitized);
      const fallbackSelection = getChildren(sanitized, "root")[0] ?? null;
      setSelectedBlockId(parsed.selectedBlockId && sanitized[parsed.selectedBlockId] ? parsed.selectedBlockId : fallbackSelection);
      setName(parsed.name ?? "");
      setDescription(parsed.description ?? "");
      setAutosaveMessage("Draft restored");
      historyRef.current = [
        {
          configuration: deepCloneDocument(sanitized),
          name: parsed.name ?? "",
          description: parsed.description ?? "",
          selectedBlockId: parsed.selectedBlockId && sanitized[parsed.selectedBlockId] ? parsed.selectedBlockId : fallbackSelection,
        },
      ];
      historyCursorRef.current = 0;
      lastSnapshotRef.current = JSON.stringify({
        configuration: sanitized,
        name: parsed.name ?? "",
        description: parsed.description ?? "",
      });
      syncHistoryState();
    } catch (error) {
      console.warn("Failed to restore autosave", error);
    }
  }, [autosaveKey, syncHistoryState]);

  useEffect(() => {
    if (typeof window === "undefined" || isRestoringRef.current) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setAutosaveMessage("Saving draft…");
    autosaveTimerRef.current = setTimeout(() => {
      try {
        const payload: AutosaveSnapshot = {
          configuration,
          name,
          description,
          selectedBlockId,
          updatedAt: Date.now(),
        };
        window.localStorage.setItem(autosaveKey, JSON.stringify(payload));
        setHasLocalDraft(true);
        setAutosaveMessage("Draft saved");
      } catch (error) {
        console.error("Failed to autosave email template", error);
        setAutosaveMessage("Autosave failed");
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [configuration, name, description, selectedBlockId, autosaveKey]);

  useEffect(() => {
    setInspectorTab("content");
  }, [selectedBlockId]);

  const rootSettings = (configuration.root?.data ?? {}) as EmailLayoutSettings;
  const selectedBlock = selectedBlockId ? configuration[selectedBlockId] : null;
  const activePreviewMode =
    PREVIEW_MODES.find((mode) => mode.id === previewMode) ?? PREVIEW_MODES[0];
  const searchTerm = blockSearch.trim().toLowerCase();

  // Enhanced search with tags and category filtering
  const librarySource = BLOCK_LIBRARY.filter((item) => {
    // Filter by category if selected
    if (selectedCategory && item.category !== selectedCategory) {
      return false;
    }

    // Filter by search term (label, description, or tags)
    if (searchTerm.length > 0) {
      const haystack = `${item.label} ${item.description ?? ""} ${item.tags?.join(" ") ?? ""}`.toLowerCase();
      return haystack.includes(searchTerm);
    }

    return true;
  });

  const hasSearch = searchTerm.length > 0;
  const hasFilters = hasSearch || selectedCategory !== null;
  const filteredBlocks = librarySource.filter((item) => item.kind === "block");
  const filteredPresets = librarySource.filter((item) => item.kind === "preset");
  const historyCursorPosition = historyStats.total > 0 ? historyStats.cursor + 1 : 0;

  const favoriteLibraryItems = (hasFilters ? librarySource : BLOCK_LIBRARY).filter((item) =>
    favoriteIds.includes(item.id)
  );

  const recentlyUsedItems = recentlyUsedIds
    .map((id) => BLOCK_LIBRARY.find((item) => item.id === id))
    .filter((item): item is BlockLibraryItem =>
      item !== undefined && (!hasFilters || librarySource.includes(item))
    );
  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) return "Draft not yet synced";
    return new Date(lastSyncedAt).toLocaleString();
  }, [lastSyncedAt]);
  const isThemePresetActive = useCallback(
    (presetId: string) => {
      const preset = THEME_PRESETS.find((preset) => preset.id === presetId);
      if (!preset) return false;
      const tokens = preset.tokens;
      return (
        (rootSettings.backdropColor ?? null) === tokens.backdropColor &&
        (rootSettings.canvasColor ?? null) === tokens.canvasColor &&
        (rootSettings.textColor ?? null) === tokens.textColor &&
        (rootSettings.borderColor ?? null) === tokens.borderColor &&
        (rootSettings.borderRadius ?? null) === tokens.borderRadius &&
        (rootSettings.fontFamily ?? null) === tokens.fontFamily
      );
    },
    [rootSettings.backdropColor, rootSettings.canvasColor, rootSettings.textColor, rootSettings.borderColor, rootSettings.borderRadius, rootSettings.fontFamily]
  );

  function updateDocument(
    mutator: (draft: TReaderDocument) => void,
    postUpdate?: (draft: TReaderDocument) => void
  ) {
    setConfiguration((prev) => {
      const next = deepCloneDocument(prev);
      mutator(next);
      ensureRootBlock(next);
      if (postUpdate) {
        postUpdate(next);
      }
      return next;
    });
  }

  function updateBlock(
    blockId: string,
    updater: (prev: TReaderBlock) => TReaderBlock
  ) {
    updateDocument((draft) => {
      if (!draft[blockId]) return;
      draft[blockId] = updater(draft[blockId]);
    });
  }

  function resolveInsertionTarget(): { parentId: ParentNodeId; index: number } {
    if (selectedBlockId) {
      const selected = configuration[selectedBlockId];
      if (blockSupportsChildren(selected)) {
        const children = getBlockChildren(selected);
        return { parentId: selectedBlockId, index: children.length };
      }
      const parentId = findParentId(configuration, selectedBlockId);
      if (parentId) {
        const siblings = getChildren(configuration, parentId);
        const index = siblings.indexOf(selectedBlockId);
        return { parentId, index: index + 1 };
      }
    }
    const rootChildren = getChildren(configuration, "root");
    return { parentId: "root", index: rootChildren.length };
  }

  function handleAddBlock(block: TReaderBlock) {
    const { parentId, index } = resolveInsertionTarget();

    // Apply smart defaults based on context
    const context = getBlockContext(configuration, parentId, index);
    const blockWithDefaults = applySmartDefaults(block, context);

    const [blockId, blockWithId] = ensureBlockHasId(blockWithDefaults);
    updateDocument((draft) => {
      draft[blockId] = blockWithId;
      insertChild(draft, parentId, blockId, index);
    });
    setSelectedBlockId(blockId);

    // Show hint about smart defaults
    if (block.type !== "Divider" && block.type !== "Spacer") {
      setStatusMessage("Block added with smart defaults");
      setTimeout(() => setStatusMessage(null), 2000);
    }
  }

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
  }, []);

  const handleDownloadPreview = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const blob = new Blob([previewHtml], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name.trim() || "template"}-preview.html`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download preview", error);
      setPreviewError(error instanceof Error ? error.message : "Failed to download preview");
    }
  }, [previewHtml, name]);

  const handleCopyPreview = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setPreviewError("Clipboard is not available in this environment");
      return;
    }
    try {
      await navigator.clipboard.writeText(previewHtml);
      setStatusMessage("Preview HTML copied");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (error) {
      console.error("Failed to copy preview", error);
      setPreviewError(error instanceof Error ? error.message : "Failed to copy preview");
    }
  }, [previewHtml]);

  const handleOpenPreview = useCallback(() => {
    setPreviewError(null);
    setIsGeneratingPreview(true);
    try {
      let doc = configuration;

      // Apply variables if sample data preview is enabled
      if (previewWithSampleData && availableVariables) {
        const allVars = [
          ...availableVariables.builtIn,
          ...availableVariables.customFields,
          ...availableVariables.campaign,
          ...availableVariables.system,
        ];
        doc = applyVariablesToDocument(doc, sampleData, allVars);
      }

      const html = renderToStaticMarkup(doc, { rootBlockId: "root" });
      setPreviewHtml(html);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error("Failed to generate preview", error);
      setPreviewError(error instanceof Error ? error.message : "Failed to generate preview");
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [configuration, previewWithSampleData, availableVariables, sampleData]);

  useEffect(() => {
    if (!isPreviewOpen) return;
    function handlePreviewKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClosePreview();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        handleCopyPreview();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleDownloadPreview();
      }
    }
    window.addEventListener("keydown", handlePreviewKey);
    return () => window.removeEventListener("keydown", handlePreviewKey);
  }, [isPreviewOpen, handleClosePreview, handleCopyPreview, handleDownloadPreview]);

  const handleDiscardDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(autosaveKey);
    }
    loadTemplateState();
    setAutosaveMessage("Local draft discarded");
  }, [autosaveKey, loadTemplateState]);

  const handleInsertVariable = useCallback((variableKey: string) => {
    if (!selectedBlockId) {
      setStatusMessage("Please select a block first");
      return;
    }

    const block = configuration[selectedBlockId];
    if (!block?.data?.props) return;

    const textProp = (block.data.props.text as string) || "";
    const newText = textProp + ` {{${variableKey}}}`;

    setConfiguration((prev) => ({
      ...prev,
      [selectedBlockId]: {
        ...block,
        data: {
          ...block.data,
          props: {
            ...block.data.props,
            text: newText,
          },
        },
      },
    }));

    setStatusMessage("Variable inserted");
  }, [selectedBlockId, configuration]);



  const toggleFavorite = useCallback((itemId: string) => {
    setFavoriteIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      return [...prev, itemId];
    });
  }, []);

  const isFavorite = useCallback(
    (itemId: string) => favoriteIds.includes(itemId),
    [favoriteIds]
  );

  const FavoriteToggleButton = ({ itemId }: { itemId: string }) => {
    const active = isFavorite(itemId);
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleFavorite(itemId);
        }}
        className={`rounded-full border bg-white p-1 text-slate-400 shadow-sm transition hover:text-slate-600 ${
          active ? "border-amber-200 text-amber-600" : "border-slate-200"
        }`}
        title={active ? "Remove from favorites" : "Add to favorites"}
        aria-label={active ? "Remove from favorites" : "Add to favorites"}
      >
        <Star className={`h-3.5 w-3.5 ${active ? "fill-current" : ""}`} />
      </button>
    );
  };

  const handleAccessibilityIssueClick = useCallback((issue: AccessibilityIssue) => {
    // Select the block with the issue
    if (issue.blockId && issue.blockId !== "root") {
      setSelectedBlockId(issue.blockId);
      // Switch to settings tab to show block details
      setActiveRightTab("settings");
      setStatusMessage(`Selected block with ${issue.title.toLowerCase()}`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  }, []);

  function handleUndo() {
    if (historyCursorRef.current <= 0) return;
    const prevIndex = historyCursorRef.current - 1;
    const entry = historyRef.current[prevIndex];
    if (!entry) return;
    isRestoringRef.current = true;
    setConfiguration(deepCloneDocument(entry.configuration));
    setName(entry.name);
    setDescription(entry.description);
    setSelectedBlockId(entry.selectedBlockId);
    historyCursorRef.current = prevIndex;
    syncHistoryState();
  }

  function handleRedo() {
    if (historyCursorRef.current >= historyRef.current.length - 1) return;
    const nextIndex = historyCursorRef.current + 1;
    const entry = historyRef.current[nextIndex];
    if (!entry) return;
    isRestoringRef.current = true;
    setConfiguration(deepCloneDocument(entry.configuration));
    setName(entry.name);
    setDescription(entry.description);
    setSelectedBlockId(entry.selectedBlockId);
    historyCursorRef.current = nextIndex;
    syncHistoryState();
  }

  async function handleSave() {
    startTransition(async () => {
      try {
        const html = renderToStaticMarkup(configuration, { rootBlockId: "root" });
        const payload = {
          name: name.trim() || "Untitled template",
          description: description.trim() ? description.trim() : null,
          html,
          design: configuration,
          subjectLine: subjectLine,
          preheaderText: preheaderText,
        };
        const isUpdate = Boolean(template?.id);
        const endpoint = isUpdate
          ? `/api/email-templates/${template!.id}`
          : "/api/email-templates";
        const response = await fetch(endpoint, {
          method: isUpdate ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to save template.");
        }

        const body = (await response.json()) as { template: EmailTemplate };
        const savedTemplate = body.template;
        if (!savedTemplate?.id) {
          throw new Error("Template response was missing an ID.");
        }

        if (typeof window !== "undefined") {
          window.localStorage.removeItem(autosaveKey);
        }
        setHasLocalDraft(false);
        setAutosaveMessage("Synced to workspace");
        setStatusMessage("Saved to workspace");
        setTimeout(() => setStatusMessage(null), 4000);
        setLastSyncedAt(Date.now());

        if (!isUpdate) {
          router.replace(`/dashboard/email-templates/${savedTemplate.id}/editor`);
        }

        if (onSaved) {
          onSaved(savedTemplate);
        }
      } catch (error) {
        console.error("Failed to save template", error);
        setStatusMessage(error instanceof Error ? error.message : "Failed to save");
      }
    });
  }

  function handleDuplicate(blockId: string) {
    const { rootId, nodes } = cloneSubtree(configuration, blockId);
    updateDocument((draft) => {
      Object.assign(draft, nodes);
      const parentId = findParentId(draft, blockId);
      if (parentId) {
        const siblings = getChildren(draft, parentId);
        const index = siblings.indexOf(blockId);
        insertChild(draft, parentId, rootId, index + 1);
      }
    });
    setSelectedBlockId(rootId);
  }

  function handleRemove(blockId: string) {
    updateDocument((draft) => {
      const parentId = findParentId(draft, blockId);
      if (parentId) {
        removeChild(draft, parentId, blockId);
      }
      const descendants = collectDescendants(draft, blockId);
      descendants.forEach((id) => {
        delete draft[id];
      });
    });
    setSelectedBlockId(null);
  }

  function handleRootFieldChange(key: keyof EmailLayoutSettings, value: any) {
    updateDocument((draft) => {
      ensureRootBlock(draft);
      const data = (draft.root.data ?? {}) as EmailLayoutSettings;
      draft.root.data = { ...data, [key]: value };
    });
  }

  function handleResetGlobalStyles() {
    updateDocument((draft) => {
      ensureRootBlock(draft);
      const data = (draft.root.data ?? {}) as EmailLayoutSettings;
      draft.root.data = {
        ...data,
        backdropColor: GLOBAL_STYLE_DEFAULTS.backdropColor,
        canvasColor: GLOBAL_STYLE_DEFAULTS.canvasColor,
        textColor: GLOBAL_STYLE_DEFAULTS.textColor,
        borderColor: GLOBAL_STYLE_DEFAULTS.borderColor,
        borderRadius: GLOBAL_STYLE_DEFAULTS.borderRadius,
        fontFamily: GLOBAL_STYLE_DEFAULTS.fontFamily,
      };
    });
    setAutosaveMessage("Theme reset to defaults");
  }

  function handleApplyThemePreset(tokens: Partial<EmailLayoutSettings>, label: string) {
    updateDocument((draft) => {
      ensureRootBlock(draft);
      const data = (draft.root.data ?? {}) as EmailLayoutSettings;
      draft.root.data = { ...data, ...tokens };
    });
    setAutosaveMessage(`Applied ${label} preset`);
    setStatusMessage(`Preset: ${label}`);
    setTimeout(() => setStatusMessage(null), 3000);
  }

  function handleLibrarySelection(item: BlockLibraryItem) {
    // Track recently used
    setRecentlyUsedIds((prev) => {
      const filtered = prev.filter((id) => id !== item.id);
      const updated = [item.id, ...filtered].slice(0, RECENTLY_USED_LIMIT);
      return updated;
    });

    if (item.kind === "block") {
      handleAddBlock(item.createBlock());
    } else {
      const result = item.createPreset();
      if (Array.isArray(result)) {
        // For array of blocks, we need to add them sequentially or wrap them
        // Current handleAddBlock only takes one block.
        // We can iterate and add them.
        result.forEach(block => handleAddBlock(block));
      } else {
        // It's a PresetDefinition object { rootId, nodes }
        // We need to merge nodes into document and insert rootId
        const { rootId, nodes } = result;
        const { parentId, index } = resolveInsertionTarget();
        updateDocument((draft) => {
          Object.assign(draft, nodes);
          insertChild(draft, parentId, rootId, index);
        });
        setSelectedBlockId(rootId);
      }
    }
  }


  function renderIcon(icon: string) {
    switch (icon) {
      case "H1": return <Type className="h-6 w-6" />;
      case "TXT": return <Type className="h-6 w-6" />;
      case "BTN": return <Plus className="h-6 w-6" />;
      case "IMG": return <ImageIcon className="h-6 w-6" />;
      case "LAY": return <Layout className="h-6 w-6" />;
      case "---": return <Minus className="h-6 w-6" />;
      case "SPC": return <Minus className="h-6 w-6" />;
      case "<>": return <Code className="h-6 w-6" />;
      case "SOC": return <Share2 className="h-6 w-6" />;
      case "VID": return <Video className="h-6 w-6" />;
      case "⭐": return <Star className="h-6 w-6" />;
      case "⚡": return <Zap className="h-6 w-6" />;
      case "◆": return <BarChart className="h-6 w-6" />;
      case "FTR": return <LayoutTemplate className="h-6 w-6" />;
      default: return <div className="h-6 w-6 bg-slate-200 rounded" />;
    }
  }

  function renderBlockTree(blockId: string, depth = 0): React.ReactNode {
    const block = configuration[blockId];
    if (!block) return null;
    const isSelected = selectedBlockId === blockId;
    const label = BLOCK_META[block.type]?.label ?? block.type;
    const children = getChildren(configuration, blockId);
    const hasChildren = children.length > 0;

    return (
      <div key={blockId} style={{ paddingLeft: depth * 12 }}>
        <div
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer ${isSelected ? "bg-slate-100 text-slate-900 font-medium" : "text-slate-600 hover:bg-slate-50"
            }`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedBlockId(blockId);
          }}
        >
          <span className="text-slate-400">
            {hasChildren ? <Layers className="h-3 w-3" /> : <div className="h-3 w-3" />}
          </span>
          {label}
        </div>
        {children.map((childId) => renderBlockTree(childId, depth + 1))}
      </div>
    );
  }

  // Hotkeys
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Block insertion hotkeys
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const type = HOTKEY_BLOCKS[e.code];
        if (type) {
          e.preventDefault();
          const libraryItem = BLOCK_LIBRARY.find(item => item.kind === "block" && item.type === type);
          if (libraryItem && libraryItem.kind === "block") {
            handleAddBlock(libraryItem.createBlock());
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [configuration, selectedBlockId]);

  // Onboarding tour steps
  const tourSteps = [
    {
      target: ".left-sidebar",
      title: "Block Library",
      content: "Add blocks and presets from this library. Click any block to insert it into your email template. Favorites are shown at the top for quick access.",
      placement: "right" as const,
    },
    {
      target: ".variables-tab",
      title: "Variable System",
      content: "Use variables like {{firstName}} to personalize emails for each recipient. Click to insert or drag variables into any text field.",
      placement: "right" as const,
    },
    {
      target: ".canvas-container",
      title: "Email Canvas",
      content: "Your email design appears here. Click any block to select and edit it. The canvas updates in real-time as you make changes.",
      placement: "top" as const,
    },
    {
      target: ".right-sidebar",
      title: "Block Inspector",
      content: "Customize the selected block's content, style, and spacing here. Each block type has different options available.",
      placement: "left" as const,
    },
    {
      target: "[title='Preview']",
      title: "Preview Your Email",
      content: "Preview your email in different screen sizes (desktop, tablet, mobile) before saving. You can also download or copy the HTML.",
      placement: "bottom" as const,
    },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Onboarding Tour */}
      <OnboardingTour
        steps={tourSteps}
        storageKey="email-builder-tour-completed"
        onComplete={() => {
          // Optional: track tour completion
          console.log("Onboarding tour completed");
        }}
      />
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Back to templates"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex flex-col gap-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template Name"
              className="bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              className="bg-transparent text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{autosaveMessage}</span>
              {hasLocalDraft ? (
                <>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Local draft
                  </span>
                  <button
                    onClick={handleDiscardDraft}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 transition hover:bg-amber-100"
                  >
                    Discard
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            {PREVIEW_MODES.map((mode) => {
              const Icon = PREVIEW_ICON_MAP[mode.id];
              const isActive = previewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setPreviewMode(mode.id)}
                  className={`rounded px-2 py-1.5 transition-all ${isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                    }`}
                  title={`${mode.label} preview (${mode.width}px)`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <span className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:inline">
            {activePreviewMode.label} · {activePreviewMode.width}px
          </span>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          <button
            onClick={handleUndo}
            disabled={!canUndo}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={!canRedo}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </button>

          <span className="hidden items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 md:inline-flex">
            History {historyCursorPosition}/{historyStats.total}
          </span>

          {/* Warnings & Accessibility Badges */}
          <div className="flex items-center gap-2">
            {(warningCounts.errors > 0 || warningCounts.warnings > 0) && (
              <div className="flex items-center gap-1">
                {warningCounts.errors > 0 && (
                  <WarningsBadge count={warningCounts.errors} severity="error" />
                )}
                {warningCounts.warnings > 0 && (
                  <WarningsBadge count={warningCounts.warnings} severity="warning" />
                )}
              </div>
            )}
            <AccessibilityBadge
              score={accessibilityReport.score}
              issueCount={accessibilityReport.issues.length}
            />
          </div>

          <div className="h-6 w-px bg-slate-200 mx-2" />

          <button
            onClick={handleOpenPreview}
            disabled={isGeneratingPreview}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            {isGeneratingPreview ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Preview
          </button>
          <div className="hidden items-center gap-2 border-l border-slate-200 pl-4 text-xs text-slate-600 lg:flex">
            <span className="font-medium">Preview with sample data:</span>
            <button
              type="button"
              onClick={() => setPreviewWithSampleData((prev) => !prev)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${previewWithSampleData ? "bg-blue-600" : "bg-slate-300"}`}
              aria-pressed={previewWithSampleData}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${previewWithSampleData ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
      </header>

      {/* Status Messages - Fixed Position Toast */}
      {statusMessage && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            {statusMessage}
          </div>
        </div>
      )}
      {previewError && (
        <div className="fixed top-20 right-6 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            {previewError}
          </div>
        </div>
      )}

      {/* Subject Line & Preheader Editor */}
      <SubjectPreheaderWithAutocomplete
        subjectLine={subjectLine}
        preheaderText={preheaderText}
        onSubjectChange={setSubjectLine}
        onPreheaderChange={setPreheaderText}
        variables={availableVariables ? [
          ...availableVariables.builtIn,
          ...availableVariables.customFields,
          ...availableVariables.campaign,
          ...availableVariables.system,
        ] : []}
        sampleData={sampleData}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Insert & Layers */}
        <aside className="left-sidebar flex w-80 flex-col border-r border-slate-200 bg-white z-10">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveLeftTab("insert")}
              className={`flex-1 border-b-2 py-3 text-sm font-medium transition-colors ${activeLeftTab === "insert"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Insert
            </button>
            <button
              onClick={() => setActiveLeftTab("layers")}
              className={`flex-1 border-b-2 py-3 text-sm font-medium transition-colors ${activeLeftTab === "layers"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Layers
            </button>
            <button
              onClick={() => setActiveLeftTab("variables")}
              className={`variables-tab flex-1 border-b-2 py-3 text-sm font-medium transition-colors ${activeLeftTab === "variables"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Variables
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeLeftTab === "insert" ? (
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Search library
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
                    <input
                      type="search"
                      value={blockSearch}
                      onChange={(event) => setBlockSearch(event.target.value)}
                      placeholder="Blocks, presets, components…"
                      className="flex-1 bg-transparent text-slate-700 placeholder:text-slate-400 focus:outline-none"
                    />
                    {blockSearch ? (
                      <button
                        onClick={() => setBlockSearch("")}
                        className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        title="Clear search"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Category Filters */}
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        selectedCategory === null
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      All
                    </button>
                    {BLOCK_CATEGORIES.map((category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          selectedCategory === category
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                {hasFilters && filteredBlocks.length === 0 && filteredPresets.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No blocks match your filters. Try adjusting your search or category.
                  </div>
                ) : null}

                {/* Recently Used */}
                {recentlyUsedItems.length > 0 && !hasFilters ? (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Recently Used
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {recentlyUsedItems.map((item) => (
                        <div key={item.id} className="relative min-w-[140px]">
                          <button
                            onClick={() => handleLibrarySelection(item)}
                            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-left transition-all hover:border-sky-300 hover:shadow-sm"
                          >
                            <div className="text-sky-600">{renderIcon(item.icon)}</div>
                            <div className="text-xs font-semibold text-sky-900">{item.label}</div>
                            <div className="text-[10px] uppercase tracking-wide text-sky-500">
                              {item.kind === "block" ? "Block" : "Preset"}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {favoriteLibraryItems.length > 0 ? (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Favorites
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {favoriteLibraryItems.map((item) => (
                        <div key={item.id} className="relative min-w-[200px]">
                          <button
                            onClick={() => handleLibrarySelection(item)}
                            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-300 hover:shadow-sm"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                              {renderIcon(item.icon)}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                                {item.kind === "block" ? "Block" : "Preset"}
                              </div>
                            </div>
                          </button>
                          <div className="absolute right-3 top-3">
                            <FavoriteToggleButton itemId={item.id} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Blocks
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredBlocks.map((item) => {
                      const hotkey = Object.entries(HOTKEY_BLOCKS).find(([_, type]) => type === item.type)?.[0]?.replace("Key", "");
                      return (
                        <div key={item.id} className="relative group">
                          <button
                            onClick={() => handleLibrarySelection(item)}
                            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 transition-all hover:border-slate-300 hover:bg-white hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
                            aria-label={`Add ${item.label} block${hotkey ? ` (Alt+${hotkey})` : ""}`}
                          >
                            <div className="text-slate-600">{renderIcon(item.icon)}</div>
                            <span className="text-xs font-medium text-slate-700">{item.label}</span>
                            {hotkey && (
                              <span className="text-[10px] text-slate-400 font-mono">Alt+{hotkey}</span>
                            )}
                          </button>
                          <div className="absolute right-2 top-2">
                            <FavoriteToggleButton itemId={item.id} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Presets
                  </h3>
                  <div className="space-y-3">
                    {filteredPresets.map((item) => (
                      <div key={item.id} className="relative group">
                        <button
                          onClick={() => handleLibrarySelection(item)}
                          className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-slate-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1"
                          aria-label={`Add ${item.label} preset`}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                            {renderIcon(item.icon)}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">{item.label}</div>
                            <div className="text-xs text-slate-500">{item.description}</div>
                          </div>
                        </button>
                        <div className="absolute right-3 top-3">
                          <FavoriteToggleButton itemId={item.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keyboard Shortcuts Help */}
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-xs font-semibold text-slate-900 mb-2">Keyboard Shortcuts</h4>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Undo</span>
                      <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm border border-slate-200">Ctrl+Z</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Redo</span>
                      <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm border border-slate-200">Ctrl+Y</kbd>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Quick add blocks</span>
                      <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-700 shadow-sm border border-slate-200">Alt+Key</kbd>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeLeftTab === "layers" ? (
              <div className="space-y-1">
                {renderBlockTree("root")}
              </div>
            ) : activeLeftTab === "variables" && availableVariables ? (
              <div className="flex-1 overflow-hidden">
                <EnhancedVariableLibrary
                  variables={availableVariables}
                  usedVariables={usedVariables}
                  sampleData={sampleData}
                  onInsertVariable={handleInsertVariable}
                />
              </div>
            ) : null}
          </div>
        </aside>

        {/* Center: Canvas */}
        <main className="canvas-container flex flex-1 items-center justify-center overflow-hidden bg-slate-100/50 p-8">
          <div
            className="h-full w-full overflow-y-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition-all duration-300"
            style={{ maxWidth: `${activePreviewMode.width}px` }}
            onClick={() => setSelectedBlockId(null)}
          >
            <Reader document={configuration} rootBlockId="root" />
          </div>
        </main>

        {/* Right Sidebar: Settings, Styles & Accessibility */}
        <aside className="right-sidebar flex w-80 flex-col border-l border-slate-200 bg-white z-10">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveRightTab("settings")}
              className={`flex-1 border-b-2 py-3 text-xs font-medium transition-colors ${activeRightTab === "settings"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Settings
            </button>
            <button
              onClick={() => setActiveRightTab("styles")}
              className={`flex-1 border-b-2 py-3 text-xs font-medium transition-colors ${activeRightTab === "styles"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              Styles
            </button>
            <button
              onClick={() => setActiveRightTab("accessibility")}
              className={`flex-1 border-b-2 py-3 text-xs font-medium transition-colors ${activeRightTab === "accessibility"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              A11y
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
                {activeRightTab === "settings" ? (
                  selectedBlock ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                      <h3 className="font-semibold text-slate-900">
                        {BLOCK_META[selectedBlock.type]?.label ?? selectedBlock.type}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {BLOCK_META[selectedBlock.type]?.description}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDuplicate(selectedBlockId!)}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRemove(selectedBlockId!)}
                        className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                      </div>
                      <div className="h-px bg-slate-100" />

                      {/* Warnings Panel */}
                      {currentBlockWarnings.length > 0 && (
                        <>
                          <WarningsPanel
                            warnings={currentBlockWarnings}
                            onActionClick={() => {
                              // Focus will be set by the warning itself
                              // This is a placeholder for potential future actions
                            }}
                          />
                          <div className="h-px bg-slate-100" />
                        </>
                      )}

                      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                        {INSPECTOR_TABS.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setInspectorTab(tab.id)}
                            className={`flex-1 rounded-lg px-3 py-1 transition ${inspectorTab === tab.id
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                              }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                      <Inspector
                        block={selectedBlock}
                        activeTab={inspectorTab}
                        onChange={(updater) => updateBlock(selectedBlockId!, updater)}
                        variables={availableVariables || undefined}
                        sampleData={sampleData}
                      />
                    </div>
                  ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                  <Settings className="mb-3 h-8 w-8 opacity-20" />
                  <p className="text-sm">Select a block to edit its settings</p>
                </div>
              )
            ) : activeRightTab === "styles" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-slate-900">Global Styles</h3>
                  <p className="text-xs text-slate-500">
                    Customize the default appearance of your email.
                  </p>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="space-y-4">
                  <ColorInputField
                    label="Backdrop Color"
                    value={rootSettings.backdropColor}
                    onChange={(v) => handleRootFieldChange("backdropColor", v)}
                  />
                  <ColorInputField
                    label="Canvas Color"
                    value={rootSettings.canvasColor}
                    onChange={(v) => handleRootFieldChange("canvasColor", v)}
                  />
                  <ColorInputField
                    label="Text Color"
                    value={rootSettings.textColor}
                    onChange={(v) => handleRootFieldChange("textColor", v)}
                  />
                  <ColorInputField
                    label="Border Color"
                    value={rootSettings.borderColor}
                    onChange={(v) => handleRootFieldChange("borderColor", v)}
                  />
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-medium text-slate-700">
                      Canvas Radius
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">
                        {rootSettings.borderRadius ?? 0}px
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={48}
                      step={1}
                      value={rootSettings.borderRadius ?? 0}
                      onChange={(e) =>
                        handleRootFieldChange("borderRadius", Number(e.target.value) || 0)
                      }
                      className="w-full accent-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700">Font Family</label>
                    <select
                      value={rootSettings.fontFamily ?? "MODERN_SANS"}
                      onChange={(e) => handleRootFieldChange("fontFamily", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none"
                    >
                      {FONT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Brand presets
                    </p>
                    <div className="grid gap-2">
                      {THEME_PRESETS.map((preset) => {
                        const active = isThemePresetActive(preset.id);
                        return (
                          <button
                            key={preset.id}
                            onClick={() => handleApplyThemePreset(preset.tokens, preset.label)}
                            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                              active
                                ? "border-slate-900 bg-slate-900/5 text-slate-900"
                                : "border-slate-200 text-slate-700 hover:border-slate-400"
                            }`}
                          >
                            <div>
                              <p className="text-sm font-semibold">{preset.label}</p>
                              <p className="text-xs text-slate-500">{preset.description}</p>
                            </div>
                            {active ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                Active
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleResetGlobalStyles}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400"
                  >
                    Reset theme
                  </button>
                </div>
              </div>
            ) : activeRightTab === "accessibility" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-900">Accessibility Audit</h3>
                  <p className="text-xs text-slate-500">
                    WCAG 2.1 compliance check for your email template.
                  </p>
                </div>
                <div className="h-px bg-slate-100" />
                <AccessibilityPanel
                  report={accessibilityReport}
                  onIssueClick={handleAccessibilityIssueClick}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {isPreviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-8">
          <div className="relative flex h-full max-h-[90vh] w-full max-w-6xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={handleClosePreview}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {name.trim() || "Untitled template"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {description?.trim() || "No description added"}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Last saved · {lastSyncedLabel}</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">
                    Ctrl/⌘ C copy · Ctrl/⌘ S download · Esc close
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  className="h-full w-full bg-white"
                />
              </div>
              <div className="flex w-full flex-col gap-3 lg:w-[45%]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">HTML Output</h3>
                    <p className="text-xs text-slate-500">Static markup ready for any ESP.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyPreview}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                    <button
                      onClick={handleDownloadPreview}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
                <textarea
                  className="h-full min-h-[200px] flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-700 shadow-inner focus:border-slate-400 focus:outline-none"
                  value={previewHtml}
                  readOnly
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}



function Inspector({ block, activeTab, onChange, variables, sampleData }: InspectorProps) {
  // Check for Two-Column variant first (it's a Container with isTwoColumn prop)
  if (block.type === "Container" && block.data?.props?.isTwoColumn) {
    return <TwoColumnInspector block={block as TwoColumnBlock} onChange={onChange as never} activeTab={activeTab} />;
  }

  switch (block.type) {
    case "Heading":
      return <HeadingInspector block={block} activeTab={activeTab} onChange={onChange} variables={variables} sampleData={sampleData} />;
    case "Text":
      return <TextInspector block={block} activeTab={activeTab} onChange={onChange} variables={variables} sampleData={sampleData} />;
    case "Button":
      return <ButtonInspector block={block} activeTab={activeTab} onChange={onChange} variables={variables} sampleData={sampleData} />;
    case "Image":
      return <ImageInspector block={block} activeTab={activeTab} onChange={onChange} />;
    case "Container":
      return <ContainerInspector block={block} activeTab={activeTab} onChange={onChange} />;
    case "Divider":
      return <DividerInspector block={block} activeTab={activeTab} onChange={onChange} />;
    case "Spacer":
      return <SpacerInspector block={block} activeTab={activeTab} onChange={onChange} />;
    case "Html":
      return <HtmlInspector block={block} activeTab={activeTab} onChange={onChange} variables={variables} sampleData={sampleData} />;
    case "List":
      return <ListInspector block={block as ListBlock} onChange={onChange as never} activeTab={activeTab} />;
    case "Callout":
      return <CalloutInspector block={block as CalloutBlock} onChange={onChange as never} activeTab={activeTab} />;
    case "Testimonial":
      return <TestimonialInspector block={block as TestimonialBlock} onChange={onChange as never} activeTab={activeTab} />;
    default:
      return (
        <p className="text-sm text-slate-500">
          This block type isn't editable yet. You can still reorder or duplicate it
          from the block list.
        </p>
      );
  }
}

function HeadingInspector({ block, activeTab, onChange, variables, sampleData }: InspectorProps) {
  const style = (block.data?.style ?? {}) as LooseStyle;
  const props = (block.data?.props ?? {}) as LooseProps;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const headingText = typeof props.text === "string" ? props.text : "";
  const headingLevel = typeof props.level === "string" ? props.level : "h2";
  const textColor = typeof style.color === "string" ? style.color : null;
  const fontSize = typeof style.fontSize === "number" ? style.fontSize : 32;
  const textAlign = style.textAlign ?? "left";

  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Text
            <SimpleVariableAutocomplete
              value={headingText}
              onChange={(value) =>
                onChange((prev) => patchBlock(prev, { props: { text: value } }))
              }
              variables={variables ? [
                ...variables.builtIn,
                ...variables.customFields,
                ...variables.campaign,
                ...variables.system,
              ] : []}
              sampleData={sampleData || {}}
              placeholder="Enter heading text... (type {{ for variables)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
              rows={3}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Heading level
            <select
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={headingLevel}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { level: event.target.value } }))
              }
            >
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
          </label>
        </>
      )}
      {activeTab === "style" && (
        <>
          <ColorInputField
            label="Text color"
            value={textColor}
            onChange={(value) => onChange((prev) => patchBlock(prev, { style: { color: value } }))}
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Font size
            <input
              type="number"
              min={14}
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={fontSize}
              onChange={(event) =>
                onChange((prev) =>
                  patchBlock(prev, { style: { fontSize: Number(event.target.value) || 24 } })
                )
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Alignment
            <select
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={textAlign}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { style: { textAlign: event.target.value } }))
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function TextInspector({ block, activeTab, onChange, variables, sampleData }: InspectorProps) {
  const style = (block.data?.style ?? {}) as LooseStyle;
  const props = (block.data?.props ?? {}) as LooseProps;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const bodyText = typeof props.text === "string" ? props.text : "";
  const fontSize = typeof style.fontSize === "number" ? style.fontSize : 16;
  const textAlign = style.textAlign ?? "left";
  const textColor = typeof style.color === "string" ? style.color : null;

  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Content
            <SimpleVariableAutocomplete
              value={bodyText}
              onChange={(value) =>
                onChange((prev) => patchBlock(prev, { props: { text: value } }))
              }
              variables={variables ? [
                ...variables.builtIn,
                ...variables.customFields,
                ...variables.campaign,
                ...variables.system,
              ] : []}
              sampleData={sampleData || {}}
              placeholder="Enter text content... (type {{ for variables)"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-900"
              rows={4}
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(props.markdown)}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { markdown: event.target.checked } }))
              }
            />
            Render markdown
          </label>
        </>
      )}
      {activeTab === "style" && (
        <>
          <ColorInputField
            label="Text color"
            value={textColor}
            onChange={(value) => onChange((prev) => patchBlock(prev, { style: { color: value } }))}
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Font size
            <input
              type="number"
              min={12}
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={fontSize}
              onChange={(event) =>
                onChange((prev) =>
                  patchBlock(prev, { style: { fontSize: Number(event.target.value) || 16 } })
                )
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Alignment
            <select
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={textAlign}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { style: { textAlign: event.target.value } }))
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function ButtonInspector({ block, activeTab, onChange }: InspectorProps) {
  const style = (block.data?.style ?? {}) as LooseStyle;
  const props = (block.data?.props ?? {}) as LooseProps;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const labelValue = typeof props.text === "string" ? props.text : "";
  const urlValue = typeof props.url === "string" ? props.url : "";
  const sizeValue = typeof props.size === "string" ? props.size : "medium";
  const buttonStyleValue = typeof props.buttonStyle === "string" ? props.buttonStyle : "rounded";
  const buttonColor = typeof props.buttonBackgroundColor === "string" ? props.buttonBackgroundColor : null;
  const textColor = typeof props.buttonTextColor === "string" ? props.buttonTextColor : null;
  const alignment = style.textAlign ?? "left";

  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Label
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={labelValue}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { text: event.target.value } }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            URL
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={urlValue}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { url: event.target.value } }))
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Size
              <select
                className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
                value={sizeValue}
                onChange={(event) =>
                  onChange((prev) => patchBlock(prev, { props: { size: event.target.value } }))
                }
              >
                <option value="x-small">X-small</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Style
              <select
                className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
                value={buttonStyleValue}
                onChange={(event) =>
                  onChange((prev) => patchBlock(prev, { props: { buttonStyle: event.target.value } }))
                }
              >
                <option value="rounded">Rounded</option>
                <option value="rectangle">Rectangle</option>
                <option value="pill">Pill</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={Boolean(props.fullWidth)}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { fullWidth: event.target.checked } }))
              }
            />
            Full width
          </label>
        </>
      )}
      {activeTab === "style" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Alignment
            <select
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={alignment}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { style: { textAlign: event.target.value } }))
              }
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <ColorInputField
            label="Button color"
            value={buttonColor}
            onChange={(value) =>
              onChange((prev) => patchBlock(prev, { props: { buttonBackgroundColor: value } }))
            }
          />
          <ColorInputField
            label="Text color"
            value={textColor}
            onChange={(value) =>
              onChange((prev) => patchBlock(prev, { props: { buttonTextColor: value } }))
            }
          />
        </>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function ImageInspector({ block, activeTab, onChange }: InspectorProps) {
  const style = (block.data?.style ?? {}) as LooseStyle;
  const props = (block.data?.props ?? {}) as LooseProps;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const imageUrl = typeof props.url === "string" ? props.url : "";
  const altText = typeof props.alt === "string" ? props.alt : "";
  const linkHref = typeof props.linkHref === "string" ? props.linkHref : "";
  const widthValue = typeof props.width === "number" ? props.width : "";
  const heightValue = typeof props.height === "number" ? props.height : "";
  const alignment = style.textAlign ?? "center";

  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Image URL
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={imageUrl}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { url: event.target.value } }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Alt text
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={altText}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { alt: event.target.value } }))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Link URL (optional)
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              value={linkHref}
              onChange={(event) =>
                onChange((prev) => patchBlock(prev, { props: { linkHref: event.target.value } }))
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Width (px)
              <input
                type="number"
                min={0}
                className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
                value={widthValue}
                onChange={(event) =>
                  onChange((prev) =>
                    patchBlock(prev, {
                      props: { width: event.target.value === "" ? null : Number(event.target.value) },
                    })
                  )
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Height (px)
              <input
                type="number"
                min={0}
                className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
                value={heightValue}
                onChange={(event) =>
                  onChange((prev) =>
                    patchBlock(prev, {
                      props: { height: event.target.value === "" ? null : Number(event.target.value) },
                    })
                  )
                }
              />
            </label>
          </div>
        </>
      )}
      {activeTab === "style" && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Alignment
          <select
            className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
            value={alignment}
            onChange={(event) =>
              onChange((prev) => patchBlock(prev, { style: { textAlign: event.target.value } }))
            }
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function ContainerInspector({ block, activeTab, onChange }: InspectorProps) {
  const style = (block.data?.style ?? {}) as LooseStyle;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const backgroundColor = typeof style.backgroundColor === "string" ? style.backgroundColor : null;
  const borderColor = typeof style.borderColor === "string" ? style.borderColor : null;
  const borderRadius = typeof style.borderRadius === "number" ? style.borderRadius : 16;

  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Containers hold other blocks. Select this section in the tree to drop content inside.
        </p>
      )}
      {activeTab === "style" && (
        <>
          <ColorInputField
            label="Background"
            value={backgroundColor}
            onChange={(value) =>
              onChange((prev) => patchBlock(prev, { style: { backgroundColor: value } }))
            }
          />
          <ColorInputField
            label="Border color"
            value={borderColor}
            onChange={(value) =>
              onChange((prev) => patchBlock(prev, { style: { borderColor: value } }))
            }
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Border radius
            <input
              type="number"
              min={0}
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={borderRadius}
              onChange={(event) =>
                onChange((prev) =>
                  patchBlock(prev, { style: { borderRadius: Number(event.target.value) || 0 } })
                )
              }
            />
          </label>
        </>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function DividerInspector({ block, activeTab, onChange }: InspectorProps) {
  const style = (block.data?.style ?? {}) as LooseStyle;
  const props = (block.data?.props ?? {}) as LooseProps;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const lineColor = typeof props.lineColor === "string" ? props.lineColor : null;
  const lineHeight = typeof props.lineHeight === "number" ? props.lineHeight : 1;

  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Dividers visually separate sections. Adjust colors and spacing on the other tabs.
        </p>
      )}
      {activeTab === "style" && (
        <>
          <ColorInputField
            label="Line color"
            value={lineColor}
            onChange={(value) =>
              onChange((prev) => patchBlock(prev, { props: { lineColor: value } }))
            }
          />
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Line height (px)
            <input
              type="number"
              min={1}
              className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
              value={lineHeight}
              onChange={(event) =>
                onChange((prev) =>
                  patchBlock(prev, { props: { lineHeight: Number(event.target.value) || 1 } })
                )
              }
            />
          </label>
        </>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function SpacerInspector({ block, activeTab, onChange }: InspectorProps) {
  const props = (block.data?.props ?? {}) as LooseProps;
  const height = typeof props.height === "number" ? props.height : 24;
  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Height (px)
          <input
            type="number"
            min={4}
            className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
            value={height}
            onChange={(event) =>
              onChange((prev) =>
                patchBlock(prev, { props: { height: Number(event.target.value) || 8 } })
              )
            }
          />
        </label>
      )}
      {activeTab !== "content" && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Spacer blocks only control their height. No additional style or spacing options are
          available.
        </p>
      )}
    </div>
  );
}

function HtmlInspector({ block, activeTab, onChange }: InspectorProps) {
  const props = (block.data?.props ?? {}) as LooseProps;
  const style = (block.data?.style ?? {}) as LooseStyle;
  const padding = { ...DEFAULT_PADDING, ...(style.padding ?? {}) };
  const contents = typeof props.contents === "string" ? props.contents : "";
  return (
    <div className="space-y-3 text-sm">
      {activeTab === "content" && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          HTML contents
          <textarea
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            rows={6}
            value={contents}
            onChange={(event) =>
              onChange((prev) => patchBlock(prev, { props: { contents: event.target.value } }))
            }
            spellCheck={false}
          />
        </label>
      )}
      {activeTab === "style" && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Style HTML snippets directly inside your markup if needed.
        </p>
      )}
      {activeTab === "spacing" && (
        <PaddingInputs
          padding={padding}
          onChange={(next) => onChange((prev) => patchBlock(prev, { style: { padding: next } }))}
        />
      )}
    </div>
  );
}

function getPaddingStyle(padding?: LoosePadding) {
  const source = padding ?? DEFAULT_PADDING;
  return {
    paddingTop: (source.top ?? DEFAULT_PADDING.top) + "px",
    paddingBottom: (source.bottom ?? DEFAULT_PADDING.bottom) + "px",
    paddingLeft: (source.left ?? DEFAULT_PADDING.left) + "px",
    paddingRight: (source.right ?? DEFAULT_PADDING.right) + "px",
  };
}

function getFontFamilyValue(fontFamily?: string | null) {
  const value = fontFamily ?? "MODERN_SANS";
  switch (value) {
    case "MODERN_SANS":
      return '"Helvetica Neue", Arial, sans-serif';
    case "BOOK_SANS":
      return 'Optima, Candara, "Noto Sans", sans-serif';
    case "ORGANIC_SANS":
      return 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, sans-serif';
    case "GEOMETRIC_SANS":
      return 'Avenir, "Avenir Next LT Pro", Montserrat, Corbel, sans-serif';
    case "HEAVY_SANS":
      return '"DIN Alternate", "Franklin Gothic Medium", sans-serif';
    case "ROUNDED_SANS":
      return '"Hiragino Maru Gothic ProN", Quicksand, "Arial Rounded MT Bold", sans-serif';
    case "MODERN_SERIF":
      return 'Charter, Cambria, serif';
    case "BOOK_SERIF":
      return '"Palatino Linotype", "URW Palladio L", serif';
    case "MONOSPACE":
      return '"Courier New", monospace';
    default:
      return '"Helvetica Neue", Arial, sans-serif';
  }
}

function ColorInputField({ label, value, onChange }: ColorInputFieldProps) {
  const fallback = typeof value === "string" && value ? value : "#ffffff";
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
      {label}
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-9 w-9 cursor-pointer rounded border border-slate-200"
          value={fallback}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          type="text"
          className="flex-1 rounded-xl border border-slate-300 px-2 py-1 text-sm"
          value={value ?? ""}
          placeholder="#FFFFFF"
          onChange={(event) => onChange(event.target.value || null)}
        />
      </div>
    </label>
  );
}

function PaddingInputs({
  padding,
  onChange,
}: {
  padding: LoosePadding;
  onChange: (next: LoosePadding) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600">
      {(["top", "bottom", "left", "right"] as const).map((edge) => (
        <label key={edge} className="flex flex-col gap-1">
          Padding {edge}
          <input
            type="number"
            min={0}
            className="rounded-xl border border-slate-300 px-2 py-1 text-sm"
            value={padding[edge] ?? 0}
            onChange={(event) => {
              const next = { ...padding, [edge]: Number(event.target.value) || 0 };
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}

function ListButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: string;
  label: string;
  disabled?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function patchBlock(
  block: TReaderBlock,
  patch: { style?: Partial<BlockStylePayload>; props?: Partial<BlockPropsPayload> }
) {
  const nextData = { ...(block.data ?? {}) } as BlockDataPayload;
  if (patch.style) {
    nextData.style = {
      ...(block.data?.style ?? {}),
      ...patch.style,
    } as BlockStylePayload;
  }
  if (patch.props) {
    nextData.props = {
      ...(block.data?.props ?? {}),
      ...patch.props,
    } as BlockPropsPayload;
  }
  return {
    ...block,
    data: nextData,
  };
}

function blockSupportsChildren(block?: TReaderBlock | null) {
  if (!block) return false;
  return CHILD_SUPPORTED_TYPES.has(block.type);
}

function getBlockChildren(block?: TReaderBlock | null): string[] {
  if (!blockSupportsChildren(block)) return [];
  const props = (block?.data?.props ?? {}) as LooseProps;
  const children = props.childrenIds;
  return Array.isArray(children) ? (children as string[]) : [];
}

function ensureBlockChildren(block: TReaderBlock) {
  const data = (block.data ?? {}) as BlockDataPayload;
  const props = (data.props ?? {}) as LooseProps;
  if (!Array.isArray(props.childrenIds)) {
    props.childrenIds = [];
  }
  block.data = {
    ...data,
    props: props as BlockPropsPayload,
  };
}

function getChildren(document: TReaderDocument, parentId: ParentNodeId): string[] {
  if (parentId === "root") {
    const children = (document.root?.data as EmailLayoutSettings)?.childrenIds;
    return Array.isArray(children) ? children : [];
  }
  return getBlockChildren(document[parentId]);
}

function setChildren(document: TReaderDocument, parentId: ParentNodeId, children: string[]) {
  if (parentId === "root") {
    ensureRootBlock(document);
    const data = (document.root.data ?? {}) as EmailLayoutSettings;
    document.root.data = { ...data, childrenIds: children };
    return;
  }
  const block = document[parentId];
  if (!blockSupportsChildren(block)) return;
  ensureBlockChildren(block!);
  const props = (block!.data!.props ?? {}) as LooseProps;
  props.childrenIds = children;
}

function insertChild(
  document: TReaderDocument,
  parentId: ParentNodeId,
  childId: string,
  index: number
) {
  const current = getChildren(document, parentId);
  const copy = [...current];
  const safeIndex = Math.max(0, Math.min(index, copy.length));
  copy.splice(safeIndex, 0, childId);
  setChildren(document, parentId, copy);
}

function removeChild(document: TReaderDocument, parentId: ParentNodeId, childId: string) {
  const current = getChildren(document, parentId);
  const filtered = current.filter((id) => id !== childId);
  setChildren(document, parentId, filtered);
}

function findParentId(document: TReaderDocument, targetId: string): ParentNodeId | null {
  const queue: ParentNodeId[] = ["root"];
  while (queue.length) {
    const parentId = queue.shift()!;
    const children = getChildren(document, parentId);
    if (children.includes(targetId)) {
      return parentId;
    }
    children.forEach((childId) => {
      const childBlock = document[childId];
      if (blockSupportsChildren(childBlock)) {
        queue.push(childId);
      }
    });
  }
  return null;
}

function collectDescendants(document: TReaderDocument, blockId: string): string[] {
  const result: string[] = [blockId];
  const block = document[blockId];
  if (blockSupportsChildren(block)) {
    getBlockChildren(block).forEach((childId) => {
      result.push(...collectDescendants(document, childId));
    });
  }
  return result;
}

function cloneSubtree(document: TReaderDocument, blockId: string) {
  const source = document[blockId];
  const newId = createBlockId();
  const clone: Record<string, TReaderBlock> = {
    [newId]: deepCloneBlock(source),
  };
  if (blockSupportsChildren(source)) {
    const childIds = getBlockChildren(source);
    const newChildren: string[] = [];
    childIds.forEach((childId) => {
      const childClone = cloneSubtree(document, childId);
      Object.assign(clone, childClone.nodes);
      newChildren.push(childClone.rootId);
    });
    ensureBlockChildren(clone[newId]);
    setBlockChildren(clone[newId], newChildren);
  }
  return { rootId: newId, nodes: clone };
}

function ensureBlockHasId(block: TReaderBlock) {
  if (block.id) {
    return [block.id, block] as const;
  }
  const id = createBlockId();
  return [id, { ...block, id }] as const;
}

function setBlockChildren(block: TReaderBlock, children: string[]) {
  if (!block.data) {
    block.data = { props: { childrenIds: children } } as BlockDataPayload;
    return;
  }
  const props = (block.data.props ?? {}) as LooseProps;
  props.childrenIds = children;
  block.data = {
    ...block.data,
    props: props as BlockPropsPayload,
  };
}

function deepCloneDocument(document: TReaderDocument) {
  return JSON.parse(JSON.stringify(document)) as TReaderDocument;
}

function deepCloneBlock(block: TReaderBlock) {
  return JSON.parse(JSON.stringify(block)) as TReaderBlock;
}

function createBlockId() {
  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureRootBlock(document: TReaderDocument) {
  if (!document.root || document.root.type !== "EmailLayout") {
    document.root = deepCloneDocument(DEFAULT_DOCUMENT).root;
  }
  const data = (document.root.data ?? {}) as EmailLayoutSettings;
  if (!Array.isArray(data.childrenIds)) {
    data.childrenIds = [];
  }
  document.root.data = data;
}

function getBlockSummary(block: TReaderBlock) {
  const props = (block.data?.props ?? {}) as LooseProps;
  switch (block.type) {
    case "Heading":
    case "Text":
      return typeof props.text === "string" ? props.text : "";
    case "Button":
      if (typeof props.text === "string" && props.text) return props.text;
      return typeof props.url === "string" ? props.url : "";
    case "Image":
      return typeof props.url === "string" ? props.url : "";
    case "Html":
      return typeof props.contents === "string" ? props.contents : "";
    case "Container":
      return `${getBlockChildren(block).length} nested blocks`;
    default:
      return "";
  }
}

function prepareInitialDocument(template?: EmailTemplate | null) {
  if (template?.design_json && typeof template.design_json === "object") {
    const doc = sanitizeDocument(deepCloneDocument(template.design_json as TReaderDocument));
    ensureRootBlock(doc);
    return doc;
  }
  return sanitizeDocument(deepCloneDocument(DEFAULT_DOCUMENT));
}

function createDefaultDocument(): TReaderDocument {
  const headingId = "block-hero-heading";
  const textId = "block-hero-text";
  const buttonId = "block-hero-cta";
  const heading = patchBlock(createHeadingBlock(), {
    props: {
      text: "Launch beautiful campaigns in minutes",
      level: "h1",
    },
    style: { textAlign: "center", fontSize: 36 },
  });
  const text = patchBlock(createTextBlock(), {
    props: {
      text: "Use drag-and-drop blocks, saved layouts, and on-brand components to ship newsletters without hand-writing HTML.",
    },
    style: { textAlign: "center" },
  });
  const button = patchBlock(createButtonBlock(), {
    props: {
      text: "Explore templates",
      url: "https://example.com",
      buttonBackgroundColor: "#0369A1",
    },
    style: { textAlign: "center" },
  });

  return {
    root: {
      type: "EmailLayout",
      data: {
        backdropColor: "#F4F4F5",
        canvasColor: "#FFFFFF",
        textColor: "#0F172A",
        fontFamily: "MODERN_SANS",
        borderRadius: 18,
        childrenIds: [headingId, textId, buttonId],
      },
    },
    [headingId]: heading,
    [textId]: text,
    [buttonId]: button,
  };
}

function sanitizeDocument(document: TReaderDocument) {
  ensureRootBlock(document);
  Object.keys(document).forEach((key) => {
    if (key === "root") return;
    const block = document[key];
    if (!block || !SUPPORTED_BLOCK_TYPES.has(block.type)) {
      delete document[key];
    }
  });

  function pruneChildren(parentId: ParentNodeId) {
    const current =
      parentId === "root"
        ? ((document.root?.data as EmailLayoutSettings)?.childrenIds ?? [])
        : getBlockChildren(document[parentId]);
    const filtered = current.filter((childId) => Boolean(document[childId]));
    if (parentId === "root") {
      const data = (document.root?.data ?? {}) as EmailLayoutSettings;
      document.root!.data = { ...data, childrenIds: filtered };
    } else {
      const block = document[parentId];
      if (!blockSupportsChildren(block)) return;
      ensureBlockChildren(block!);
      const props = (block!.data!.props ?? {}) as LooseProps;
      props.childrenIds = filtered;
      block!.data = {
        ...(block!.data ?? {}),
        props: props as BlockPropsPayload,
      };
    }
  }

  pruneChildren("root");
  Object.keys(document).forEach((key) => {
    if (key === "root") return;
    pruneChildren(key);
  });

  return document;
}

function createHeadingBlock(): TReaderBlock {
  return {
    type: "Heading",
    data: {
      style: {
        color: "#0F172A",
        fontSize: 32,
        fontWeight: "bold",
        textAlign: "left",
        padding: { ...DEFAULT_PADDING },
      },
      props: {
        text: "Add a heading",
        level: "h2",
      },
    },
  };
}

function createTextBlock(): TReaderBlock {
  return {
    type: "Text",
    data: {
      style: {
        color: "#475467",
        fontSize: 16,
        textAlign: "left",
        padding: { ...DEFAULT_PADDING },
      },
      props: {
        text: "Introduce your product, tell a story, or summarize release notes.",
        markdown: true,
      },
    },
  };
}

function createButtonBlock(): TReaderBlock {
  return {
    type: "Button",
    data: {
      style: {
        textAlign: "left",
        padding: { ...DEFAULT_PADDING },
      },
      props: {
        text: "Call to action",
        url: "https://",
        size: "medium",
        buttonStyle: "rounded",
        buttonBackgroundColor: "#0F172A",
        buttonTextColor: "#FFFFFF",
        fullWidth: false,
      },
    },
  };
}

function createImageBlock(): TReaderBlock {
  return {
    type: "Image",
    data: {
      style: {
        textAlign: "center",
        padding: { ...DEFAULT_PADDING },
      },
      props: {
        url: "https://placehold.co/600x300",
        alt: "Placeholder image",
        width: 600,
        height: null,
      },
    },
  };
}

function createContainerBlock(): TReaderBlock {
  return {
    type: "Container",
    data: {
      style: {
        backgroundColor: "#F8FAFC",
        borderRadius: 18,
        padding: { ...DEFAULT_PADDING },
      },
      props: {
        childrenIds: [],
      },
    },
  };
}

function createDividerBlock(): TReaderBlock {
  return {
    type: "Divider",
    data: {
      style: {
        padding: { ...DEFAULT_PADDING },
      },
      props: {
        lineColor: "#E2E8F0",
        lineHeight: 2,
      },
    },
  };
}

function createSpacerBlock(): TReaderBlock {
  return {
    type: "Spacer",
    data: {
      props: {
        height: 24,
      },
    },
  };
}

function createHtmlBlock(): TReaderBlock {
  return {
    type: "Html",
    data: {
      style: {
        padding: { ...DEFAULT_PADDING },
        fontFamily: "MONOSPACE",
      },
      props: {
        contents: "<p>Custom HTML snippet</p>",
      },
    },
  };
}

function createHeroPreset(): PresetDefinition {
  const containerId = createBlockId();
  const badgeId = createBlockId();
  const headingId = createBlockId();
  const copyId = createBlockId();
  const buttonId = createBlockId();

  const container = patchBlock(createContainerBlock(), {
    style: {
      backgroundColor: "#E0F2FE",
      borderRadius: 28,
      padding: { ...DEFAULT_PADDING, top: 48, bottom: 48 },
    },
  });
  const eyebrow = patchBlock(createTextBlock(), {
    props: { text: "Product update • March", markdown: false },
    style: { color: "#0369A1", textAlign: "center", fontSize: 14, fontWeight: "bold" },
  });
  const heading = patchBlock(createHeadingBlock(), {
    props: { text: "Spend less time wiring HTML, more time shipping emails", level: "h1" },
    style: { textAlign: "center", fontSize: 40, color: "#0F172A" },
  });
  const body = patchBlock(createTextBlock(), {
    props: {
      text: "Drag blocks, drop presets, and publish branded newsletters without waiting on engineering.",
      markdown: false,
    },
    style: { textAlign: "center", color: "#0F172A" },
  });
  const button = patchBlock(createButtonBlock(), {
    props: {
      text: "Launch campaign",
      url: "https://example.com",
      buttonBackgroundColor: "#0F172A",
      buttonTextColor: "#FFFFFF",
    },
    style: { textAlign: "center" },
  });

  setBlockChildren(container, [badgeId, headingId, copyId, buttonId]);

  return {
    rootId: containerId,
    nodes: {
      [containerId]: container,
      [badgeId]: eyebrow,
      [headingId]: heading,
      [copyId]: body,
      [buttonId]: button,
    },
  };
}

function createFeaturePreset(): PresetDefinition {
  const containerId = createBlockId();
  const headingId = createBlockId();
  const copyId = createBlockId();
  const imageId = createBlockId();
  const buttonId = createBlockId();

  const container = patchBlock(createContainerBlock(), {
    style: {
      backgroundColor: "#FDF2F8",
      borderRadius: 24,
      padding: { ...DEFAULT_PADDING, top: 40, bottom: 40 },
    },
  });
  const heading = patchBlock(createHeadingBlock(), {
    props: { text: "Spotlight: Automated sequences", level: "h2" },
    style: { fontSize: 32, color: "#9D174D" },
  });
  const body = patchBlock(createTextBlock(), {
    props: {
      text: "Trigger onboarding, renewal, or win-back messages with visual routing and delay blocks.",
      markdown: false,
    },
    style: { color: "#831843" },
  });
  const image = patchBlock(createImageBlock(), {
    props: {
      url: "https://placehold.co/600x260/fff7f9/9d174d?text=Sequence+Preview",
      alt: "Sequence preview",
    },
    style: { borderRadius: 18 },
  });
  const button = patchBlock(createButtonBlock(), {
    props: {
      text: "View sequence builder",
      url: "https://example.com/sequences",
      buttonBackgroundColor: "#BE185D",
      buttonTextColor: "#FFFFFF",
    },
  });

  setBlockChildren(container, [headingId, copyId, imageId, buttonId]);

  return {
    rootId: containerId,
    nodes: {
      [containerId]: container,
      [headingId]: heading,
      [copyId]: body,
      [imageId]: image,
      [buttonId]: button,
    },
  };
}

function createMetricsPreset(): PresetDefinition {
  const containerId = createBlockId();
  const headingId = createBlockId();
  const statOneId = createBlockId();
  const statTwoId = createBlockId();
  const statThreeId = createBlockId();

  const container = patchBlock(createContainerBlock(), {
    style: {
      backgroundColor: "#F8FAFC",
      padding: { ...DEFAULT_PADDING, top: 36, bottom: 36 },
    },
  });
  const heading = patchBlock(createHeadingBlock(), {
    props: { text: "Proof that it works", level: "h2" },
    style: { textAlign: "center", fontSize: 30 },
  });
  const metricStyle = {
    textAlign: "center" as const,
    fontSize: 18,
    color: "#0F172A",
  };
  const statOne = patchBlock(createTextBlock(), {
    props: { text: "**96%**\nActivation rate", markdown: true },
    style: metricStyle,
  });
  const statTwo = patchBlock(createTextBlock(), {
    props: { text: "**42 hrs**\nFaster launches", markdown: true },
    style: metricStyle,
  });
  const statThree = patchBlock(createTextBlock(), {
    props: { text: "**+38%**\nClick-through lift", markdown: true },
    style: metricStyle,
  });

  setBlockChildren(container, [headingId, statOneId, statTwoId, statThreeId]);

  return {
    rootId: containerId,
    nodes: {
      [containerId]: container,
      [headingId]: heading,
      [statOneId]: statOne,
      [statTwoId]: statTwo,
      [statThreeId]: statThree,
    },
  };
}

function createSocialLinksPreset(): PresetDefinition {
  const containerId = createBlockId();
  const icon1Id = createBlockId();
  const icon2Id = createBlockId();
  const icon3Id = createBlockId();

  const container = patchBlock(createContainerBlock(), {
    style: {
      backgroundColor: "transparent",
      padding: { ...DEFAULT_PADDING, top: 10, bottom: 10 },
      textAlign: "center",
    },
  });

  const iconStyle = {
    width: 32,
    height: 32,
    display: "inline-block",
    margin: "0 8px",
  };

  const icon1 = patchBlock(createImageBlock(), {
    props: {
      url: "https://cdn-icons-png.flaticon.com/512/733/733547.png",
      alt: "Facebook",
      width: 32,
      height: 32,
      linkHref: "https://facebook.com",
    },
    style: { ...iconStyle },
  });

  const icon2 = patchBlock(createImageBlock(), {
    props: {
      url: "https://cdn-icons-png.flaticon.com/512/733/733579.png",
      alt: "Twitter",
      width: 32,
      height: 32,
      linkHref: "https://twitter.com",
    },
    style: { ...iconStyle },
  });

  const icon3 = patchBlock(createImageBlock(), {
    props: {
      url: "https://cdn-icons-png.flaticon.com/512/2111/2111463.png",
      alt: "Instagram",
      width: 32,
      height: 32,
      linkHref: "https://instagram.com",
    },
    style: { ...iconStyle },
  });

  setBlockChildren(container, [icon1Id, icon2Id, icon3Id]);

  return {
    rootId: containerId,
    nodes: {
      [containerId]: container,
      [icon1Id]: icon1,
      [icon2Id]: icon2,
      [icon3Id]: icon3,
    },
  };
}

function createVideoPreset(): PresetDefinition {
  const containerId = createBlockId();
  const imageId = createBlockId();

  const container = patchBlock(createContainerBlock(), {
    style: {
      backgroundColor: "#000000",
      padding: { ...DEFAULT_PADDING, top: 0, bottom: 0, left: 0, right: 0 },
      borderRadius: 12,
      textAlign: "center",
    },
  });

  const image = patchBlock(createImageBlock(), {
    props: {
      url: "https://placehold.co/600x337/000000/FFFFFF?text=Video+Thumbnail",
      alt: "Video thumbnail",
      width: 600,
      height: 337,
      linkHref: "https://youtube.com",
    },
    style: {
      borderRadius: 12,
      width: "100%",
      height: "auto",
    },
  });

  setBlockChildren(container, [imageId]);

  return {
    rootId: containerId,
    nodes: {
      [containerId]: container,
      [imageId]: image,
    },
  };
}

function createFooterPreset(): TReaderBlock[] {
  const containerId = crypto.randomUUID();
  const textId = crypto.randomUUID();

  return [
    {
      id: containerId,
      type: "Container",
      data: {
        style: {
          backgroundColor: "#f1f5f9",
          paddingTop: 40,
          paddingBottom: 40,
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
        },
      },
      childrenIds: [textId],
    },
    {
      id: textId,
      type: "Text",
      data: {
        props: {
          text: "<p><strong>Company Name</strong><br>123 Business Rd, Tech City, TC 90210</p><p><a href='#' style='text-decoration: underline;'>Unsubscribe</a> • <a href='#' style='text-decoration: underline;'>Privacy Policy</a></p>",
        },
        style: {
          color: "#64748b",
          fontSize: 12,
          lineHeight: 1.6,
          textAlign: "center",
        },
      },
    }
  ];
}
