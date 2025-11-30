# Phase 1 Implementation Summary

## ✅ Completed Tasks

### 1. Database Migration
**File:** `supabase/migrations/0012_add_template_variables.sql`
- Added `subject_line` and `preheader_text` columns to `email_templates`
- Created `email_template_variables` table for tracking variables
- Created `email_template_sample_data` table for preview data
- Added indexes and triggers

### 2. Variable Parser Utility
**File:** `src/lib/email/variable-parser.ts`
- `extractVariables()` - Extract variable keys from text
- `extractVariablesWithDefaults()` - Extract with default values
- `replaceVariables()` - Replace variables with actual values
- `validateVariables()` - Validate against definitions
- `applyVariablesToDocument()` - Apply to entire TReaderDocument
- Helper functions: `hasVariables()`, `countVariables()`, `escapeVariables()`, etc.

### 3. Variables API Endpoint
**File:** `src/app/api/email-templates/[id]/variables/route.ts`
- GET endpoint that fetches all available variables
- Returns built-in contact variables (firstName, lastName, email, phone, company)
- Fetches custom field definitions and transforms to variables
- Returns campaign variables (campaign.name, campaign.sendDate)
- Returns system variables (unsubscribeUrl, preferencesUrl)
- Scans template for used variables

### 4. Subject & Preheader Editor
**File:** `src/components/email-templates/subject-preheader-editor.tsx`
- Collapsible component with subject line and preheader inputs
- Character counters with color coding (green/yellow/red)
- "Insert Variable" buttons
- Recommended character limits display
- Info tip about variables and inbox preview

### 5. Variable Library Sidebar
**File:** `src/components/email-templates/variable-library.tsx`
- Search functionality for filtering variables
- Category tabs (All, Contact, Custom Fields, Campaign, System)
- Variable cards with:
  - Category icons and color coding
  - Variable syntax display
  - Description and example values
  - Usage count badges
  - Favorite stars (persisted to localStorage)
- Drag-and-drop support
- Click to insert functionality

## 🚧 Remaining Phase 1 Tasks

###  6. New Block Types
The following blocks need to be added to `src/components/email-templates/builder.tsx`:

#### A. List Block
**Type:** `"List"`
**Purpose:** Bullet/numbered lists with custom icons

**Data Structure:**
```typescript
type ListBlock = TReaderBlock & {
  type: "List";
  data: {
    props: {
      items: string[];
      listStyle: "bullet" | "number" | "check" | "arrow";
      ordered: boolean;
    };
    style: {
      padding: LoosePadding;
      iconColor?: string;
      textColor?: string;
      fontSize?: number;
      itemSpacing?: number;
      textAlign?: "left" | "center" | "right";
    };
  };
};
```

**Implementation Steps:**
1. Add to `BLOCK_LIBRARY` array around line 256
2. Create `createListBlock()` function around line 2760
3. Add List inspector to `BlockInspector` switch statement around line 1700
4. Add rendering logic to `renderToStaticMarkup` (handled by library or custom renderer)

#### B. Callout Block
**Type:** `"Callout"`
**Purpose:** Highlighted alerts, warnings, tips

**Data Structure:**
```typescript
type CalloutBlock = TReaderBlock & {
  type: "Callout";
  data: {
    props: {
      text: string;
      calloutType: "info" | "success" | "warning" | "error" | "tip";
      showIcon: boolean;
    };
    style: {
      padding: LoosePadding;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      textColor?: string;
      fontSize?: number;
    };
  };
};
```

#### C. Testimonial Block
**Type:** `"Testimonial"`
**Purpose:** Customer quotes with attribution

**Data Structure:**
```typescript
type TestimonialBlock = TReaderBlock & {
  type: "Testimonial";
  data: {
    props: {
      quote: string;
      authorName: string;
      authorTitle?: string;
      avatarUrl?: string;
      rating?: number; // 0-5
      layout: "centered" | "left" | "card";
    };
    style: {
      padding: LoosePadding;
      backgroundColor?: string;
      borderColor?: string;
      borderRadius?: number;
      quoteColor?: string;
      authorColor?: string;
      fontSize?: number;
    };
  };
};
```

#### D. Two-Column Block
**Type:** `"TwoColumn"`
**Purpose:** Side-by-side layouts

**Data Structure:**
```typescript
type TwoColumnBlock = TReaderBlock & {
  type: "TwoColumn";
  data: {
    props: {
      ratio: "50-50" | "60-40" | "40-60" | "70-30";
      gap: number;
      mobileStackOrder: "left-first" | "right-first";
      verticalAlign: "top" | "center" | "bottom";
      leftColumnId: string;
      rightColumnId: string;
    };
    style: {
      padding: LoosePadding;
      backgroundColor?: string;
    };
  };
};
```

**Note:** Two-Column extends Container pattern with child columns

### 7. Builder Integration
Main changes needed in `src/components/email-templates/builder.tsx`:

#### Add State for Variables & Metadata
```typescript
// Around line 100-150 (state declarations)
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
```

#### Fetch Variables on Mount
```typescript
// Add useEffect to fetch variables
useEffect(() => {
  if (template?.id) {
    fetch(`/api/email-templates/${template.id}/variables`)
      .then(res => res.json())
      .then(data => {
        setAvailableVariables(data.variables);
      })
      .catch(console.error);
  }
}, [template?.id]);
```

#### Add UI Components
```typescript
// Import new components at top
import { SubjectPreheaderEditor } from "./subject-preheader-editor";
import { VariableLibrary } from "./variable-library";

// In render, add SubjectPreheaderEditor before canvas (around line 800)
<SubjectPreheaderEditor
  subjectLine={subjectLine}
  preheaderText={preheaderText}
  onSubjectChange={setSubjectLine}
  onPreheaderChange={setPreheaderText}
  onInsertVariable={handleInsertVariableToMetadata}
/>

// Add VariableLibrary to left sidebar (around line 500)
// Create new tab for "Variables" next to "Insert" and "Layers"
<VariableLibrary
  variables={availableVariables || { builtIn: [], customFields: [], campaign: [], system: [] }}
  usedVariables={usedVariables}
  onInsertVariable={handleInsertVariable}
  onDragStart={handleVariableDragStart}
/>
```

#### Update Save Handler
```typescript
// Modify handleSave() around line 400
const handleSave = async () => {
  // ... existing code ...

  const payload = {
    name: templateName,
    description: templateDescription,
    design: configuration,
    html: compiledHtml,
    subjectLine: subjectLine,  // NEW
    preheaderText: preheaderText,  // NEW
  };

  // ... rest of save logic ...
};
```

#### Apply Variables to Preview
```typescript
// Modify preview rendering (around line 1200)
function renderPreview() {
  let doc = configuration;

  // Apply variables if sample data is enabled
  if (previewWithSampleData && availableVariables) {
    const allVars = [
      ...availableVariables.builtIn,
      ...availableVariables.customFields,
      ...availableVariables.campaign,
      ...availableVariables.system,
    ];
    doc = applyVariablesToDocument(doc, sampleData, allVars);
  }

  return renderToStaticMarkup(doc, { rootBlockId: "root" });
}
```

### 8. Variable Insertion Handlers
```typescript
// Add these handler functions

const handleInsertVariable = (variableKey: string) => {
  if (!selectedBlockId) return;

  const block = configuration[selectedBlockId];
  if (!block?.data?.props) return;

  // Insert {{variableKey}} into appropriate text prop
  // For now, simple concatenation; Phase 2 will add chips
  const textProp = block.data.props.text || "";
  const newText = textProp + ` {{${variableKey}}}`;

  updateBlock(selectedBlockId, {
    data: {
      ...block.data,
      props: {
        ...block.data.props,
        text: newText,
      },
    },
  });
};

const handleInsertVariableToMetadata = (field: "subject" | "preheader") => {
  // Open variable picker modal or insert at cursor
  // For now, simple alert; Phase 2 will add modal
  alert("Variable picker coming in Phase 2");
};

const handleVariableDragStart = (variableKey: string, e: React.DragEvent) => {
  e.dataTransfer.setData("text/plain", `{{${variableKey}}}`);
  e.dataTransfer.effectAllowed = "copy";
};

// Extract used variables from document
const usedVariables = useMemo(() => {
  const docStr = JSON.stringify(configuration);
  const subjectVars = extractVariables(subjectLine);
  const preheaderVars = extractVariables(preheaderText);
  const docVars = extractVariables(docStr);

  return [...new Set([...subjectVars, ...preheaderVars, ...docVars])];
}, [configuration, subjectLine, preheaderText]);
```

## 📝 Next Steps

### Immediate (Today)
1. Add List, Callout, Testimonial, Two-Column block definitions to `BLOCK_LIBRARY`
2. Create factory functions for each new block type
3. Add inspector UI for each block type
4. Integrate SubjectPreheaderEditor and VariableLibrary into builder
5. Add variable state management
6. Update save/load handlers for new fields

### Testing
1. Run database migration: `npx supabase db push` or your migration tool
2. Test variable API: `curl localhost:3000/api/email-templates/[id]/variables`
3. Test subject/preheader editor displays correctly
4. Test variable library loads custom fields
5. Test new blocks render in preview
6. Test save/load with subject line and variables

### Phase 2 Prep
- Variable chips rendering (replace plain `{{syntax}}` with styled components)
- Autocomplete dropdown on `{{` trigger
- Sample data editor modal
- Remaining 6 block types (Three-Column, Order Summary, etc.)
- Onboarding tour

## 🎯 Current Status

**Completed:** 5/10 Phase 1 tasks (50%)
**Remaining:**
- 4 new block types
- Builder integration (variable UI, state, handlers)
- Testing and debugging

**Estimated Time to Complete Phase 1:** 4-6 hours of focused work

`★ Insight ─────────────────────────────────────`
The architecture leverages the existing `@usewaypoint/email-builder` block system beautifully. Each new block type extends `TReaderBlock` with a unique `type` field and custom `data.props` structure. The library handles rendering automatically if the block type is standard, otherwise we'll need custom renderers. The variable system is non-invasive - it operates at the text replacement layer, so existing blocks don't need modification.
`─────────────────────────────────────────────────`
