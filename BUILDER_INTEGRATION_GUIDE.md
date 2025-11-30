# Email Builder Integration Guide - Phase 1

This guide provides step-by-step instructions for integrating all Phase 1 enhancements into the email template builder.

## ✅ Completed Components

All individual components have been created:

1. **Database Migration:** `supabase/migrations/0012_add_template_variables.sql`
2. **Variable Parser:** `src/lib/email/variable-parser.ts`
3. **Variables API:** `src/app/api/email-templates/[id]/variables/route.ts`
4. **Subject/Preheader Editor:** `src/components/email-templates/subject-preheader-editor.tsx`
5. **Variable Library:** `src/components/email-templates/variable-library.tsx`
6. **Block Components:**
   - `src/components/email-templates/blocks/list-block.tsx`
   - `src/components/email-templates/blocks/callout-block.tsx`
   - `src/components/email-templates/blocks/testimonial-block.tsx`
   - `src/components/email-templates/blocks/two-column-block.tsx`

## 🚀 Integration Steps

### Step 1: Run Database Migration

```bash
# If using Supabase CLI
npx supabase db push

# Or apply migration manually in Supabase dashboard
# Upload: supabase/migrations/0012_add_template_variables.sql
```

**Verify migration:**
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'email_templates'
AND column_name IN ('subject_line', 'preheader_text');

-- Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('email_template_variables', 'email_template_sample_data');
```

### Step 2: Update builder.tsx - Import New Components

Add these imports at the top of `src/components/email-templates/builder.tsx`:

```typescript
// Around line 35-40 (after existing imports)
import { SubjectPreheaderEditor } from "./subject-preheader-editor";
import { VariableLibrary } from "./variable-library";
import {
  extractVariables,
  applyVariablesToDocument,
  getDefaultSampleData,
  type VariableDefinition,
} from "@/lib/email/variable-parser";

// Import new block types
import { createListBlock, ListInspector, type ListBlock } from "./blocks/list-block";
import { createCalloutBlock, CalloutInspector, type CalloutBlock } from "./blocks/callout-block";
import { createTestimonialBlock, TestimonialInspector, type TestimonialBlock } from "./blocks/testimonial-block";
import { createTwoColumnBlock, TwoColumnInspector, type TwoColumnBlock } from "./blocks/two-column-block";
```

### Step 3: Add State Variables

Add these state variables around line 150-200 (where other useState declarations are):

```typescript
// Subject line and preheader state
const [subjectLine, setSubjectLine] = useState(template?.subject_line || "");
const [preheaderText, setPreheaderText] = useState(template?.preheader_text || "");

// Variable system state
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

// Left sidebar tab (add "variables" option)
const [leftSidebarTab, setLeftSidebarTab] = useState<"insert" | "layers" | "variables">("insert");
```

### Step 4: Fetch Variables on Mount

Add this useEffect around line 300-350:

```typescript
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
```

### Step 5: Calculate Used Variables

Add this useMemo around line 400:

```typescript
// Extract all variables used in the template
const usedVariables = useMemo(() => {
  const docStr = JSON.stringify(configuration);
  const subjectVars = extractVariables(subjectLine);
  const preheaderVars = extractVariables(preheaderText);
  const docVars = extractVariables(docStr);

  return [...subjectVars, ...preheaderVars, ...docVars];
}, [configuration, subjectLine, preheaderText]);
```

### Step 6: Add New Blocks to BLOCK_LIBRARY

Find the `BLOCK_LIBRARY` array around line 256 and add the new blocks after the existing ones:

```typescript
const BLOCK_LIBRARY: BlockLibraryItem[] = [
  // ... existing blocks (Heading, Text, Button, Image, Container, Divider, Spacer, Html) ...

  // NEW BLOCKS - Add after line 328
  {
    id: "list-block",
    kind: "block",
    type: "List",
    label: "List",
    description: "Bullet or numbered lists",
    icon: "☰",
    createBlock: createListBlock,
  },
  {
    id: "callout-block",
    kind: "block",
    type: "Callout",
    label: "Callout",
    description: "Important alerts and tips",
    icon: "⚠",
    createBlock: createCalloutBlock,
  },
  {
    id: "testimonial-block",
    kind: "block",
    type: "Testimonial",
    label: "Testimonial",
    description: "Customer quotes with author",
    icon: "💬",
    createBlock: createTestimonialBlock,
  },
  {
    id: "two-column-block",
    kind: "preset", // Note: preset type because it creates multiple blocks
    label: "Two Columns",
    description: "Side-by-side layout",
    icon: "▐▌",
    createPreset: createTwoColumnBlock,
  },

  // ... existing presets follow ...
];
```

### Step 7: Add Block Inspectors

Find the `BlockInspector` function around line 1700 and add cases for the new blocks:

```typescript
function BlockInspector({ block, activeTab, onChange }: InspectorProps) {
  // ... existing code ...

  // Add these cases in the switch statement around line 1800
  if (block.type === "List") {
    return <ListInspector block={block as ListBlock} onChange={onChange as never} activeTab={activeTab} />;
  }

  if (block.type === "Callout") {
    return <CalloutInspector block={block as CalloutBlock} onChange={onChange as never} activeTab={activeTab} />;
  }

  if (block.type === "Testimonial") {
    return <TestimonialInspector block={block as TestimonialBlock} onChange={onChange as never} activeTab={activeTab} />;
  }

  if (block.type === "Container" && block.data?.props?.isTwoColumn) {
    return <TwoColumnInspector block={block as TwoColumnBlock} onChange={onChange as never} activeTab={activeTab} />;
  }

  // ... rest of existing inspectors ...
}
```

### Step 8: Update Save Handler

Find the `handleSave` function around line 400 and update it to include new fields:

```typescript
const handleSave = async () => {
  setIsSaving(true);
  try {
    const compiledHtml = renderToStaticMarkup(configuration, { rootBlockId: "root" });

    const payload = {
      name: templateName,
      description: templateDescription,
      design: configuration,
      html: compiledHtml,
      subjectLine: subjectLine,         // NEW
      preheaderText: preheaderText,     // NEW
    };

    const endpoint = template?.id
      ? `/api/email-templates/${template.id}`
      : "/api/email-templates";
    const method = template?.id ? "PATCH" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error("Failed to save template");
    }

    const data = await res.json();
    onSaved?.(data.template);
    showToast("Template saved successfully", "success");
  } catch (error) {
    console.error("Save failed:", error);
    showToast("Failed to save template", "error");
  } finally {
    setIsSaving(false);
  }
};
```

### Step 9: Apply Variables to Preview

Find the preview rendering logic around line 1200 and update it:

```typescript
function renderPreview() {
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

  return renderToStaticMarkup(doc, { rootBlockId: "root" });
}
```

### Step 10: Add UI Components to Layout

#### A. Add SubjectPreheaderEditor

Find the main layout section around line 800 and add the editor before the canvas:

```tsx
{/* Add after the top toolbar but before canvas */}
<SubjectPreheaderEditor
  subjectLine={subjectLine}
  preheaderText={preheaderText}
  onSubjectChange={setSubjectLine}
  onPreheaderChange={setPreheaderText}
  onInsertVariable={(field) => {
    // Simple implementation - Phase 2 will add modal picker
    const variable = prompt("Enter variable name (e.g., firstName):");
    if (variable) {
      if (field === "subject") {
        setSubjectLine((prev) => prev + ` {{${variable}}}`);
      } else {
        setPreheaderText((prev) => prev + ` {{${variable}}}`);
      }
    }
  }}
/>
```

#### B. Add Variable Library to Left Sidebar

Find the left sidebar rendering around line 500 and add a "Variables" tab:

```tsx
{/* Left Sidebar - Add Variables tab */}
<div className="flex border-b border-gray-200">
  <button
    onClick={() => setLeftSidebarTab("insert")}
    className={`flex-1 px-4 py-3 text-sm font-medium ${
      leftSidebarTab === "insert"
        ? "border-b-2 border-blue-500 text-blue-600"
        : "text-gray-600 hover:text-gray-900"
    }`}
  >
    Insert
  </button>
  <button
    onClick={() => setLeftSidebarTab("layers")}
    className={`flex-1 px-4 py-3 text-sm font-medium ${
      leftSidebarTab === "layers"
        ? "border-b-2 border-blue-500 text-blue-600"
        : "text-gray-600 hover:text-gray-900"
    }`}
  >
    Layers
  </button>
  <button
    onClick={() => setLeftSidebarTab("variables")}
    className={`flex-1 px-4 py-3 text-sm font-medium ${
      leftSidebarTab === "variables"
        ? "border-b-2 border-blue-500 text-blue-600"
        : "text-gray-600 hover:text-gray-900"
    }`}
  >
    Variables
  </button>
</div>

{/* Tab Content */}
{leftSidebarTab === "insert" && (
  // ... existing Insert panel content ...
)}

{leftSidebarTab === "layers" && (
  // ... existing Layers panel content ...
)}

{leftSidebarTab === "variables" && availableVariables && (
  <VariableLibrary
    variables={availableVariables}
    usedVariables={usedVariables}
    onInsertVariable={(variableKey) => {
      // Insert variable into selected block
      if (!selectedBlockId) {
        showToast("Please select a block first", "info");
        return;
      }

      const block = configuration[selectedBlockId];
      if (!block?.data?.props) return;

      // Simple insertion - Phase 2 will add chip rendering
      const textProp = (block.data.props.text as string) || "";
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

      showToast("Variable inserted", "success");
    }}
    onDragStart={(variableKey, e) => {
      e.dataTransfer.setData("text/plain", `{{${variableKey}}}`);
      e.dataTransfer.effectAllowed = "copy";
    }}
  />
)}
```

### Step 11: Add Preview Toggle for Sample Data

Add a toggle in the preview toolbar around line 1100:

```tsx
{/* In preview mode toolbar */}
<div className="flex items-center gap-2 ml-4">
  <label className="text-sm text-gray-600">Preview with sample data:</label>
  <button
    onClick={() => setPreviewWithSampleData(!previewWithSampleData)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      previewWithSampleData ? "bg-blue-600" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        previewWithSampleData ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
</div>
```

## 🧪 Testing Checklist

### Database
- [ ] Migration ran successfully
- [ ] `subject_line` and `preheader_text` columns exist
- [ ] `email_template_variables` table created
- [ ] `email_template_sample_data` table created

### API
- [ ] `/api/email-templates/[id]/variables` returns variables
- [ ] Built-in variables included (firstName, lastName, etc.)
- [ ] Custom fields loaded from database
- [ ] System variables included (unsubscribeUrl, etc.)

### UI Components
- [ ] SubjectPreheaderEditor displays and collapses
- [ ] Character counters work and show colors
- [ ] Variable library displays with all categories
- [ ] Search filters variables correctly
- [ ] Favorite stars work and persist

### New Blocks
- [ ] List block appears in Insert panel
- [ ] List inspector shows content/style/spacing tabs
- [ ] Callout block has 5 type presets
- [ ] Testimonial block shows star rating
- [ ] Two-Column block creates nested containers

### Variable System
- [ ] Variables can be inserted into text blocks
- [ ] Preview toggle shows/hides variable replacement
- [ ] Used variables counted correctly
- [ ] Save includes subject_line and preheader_text

### Integration
- [ ] Builder loads without errors
- [ ] All existing functionality still works
- [ ] Undo/redo works with new blocks
- [ ] Preview renders new blocks
- [ ] Save/load preserves new data

## 🐛 Common Issues & Fixes

### Issue: TypeScript errors on block types

**Fix:** Add type assertions in inspectors:
```typescript
onChange={onChange as (updater: (prev: ListBlock) => ListBlock) => void}
```

### Issue: Variables not showing in library

**Fix:** Check API response and ensure custom fields service is working:
```bash
curl http://localhost:3000/api/custom-fields
```

### Issue: Two-Column block not creating children

**Fix:** Ensure `createTwoColumnBlock()` returns both `rootId` and `nodes`, and the insertion logic spreads all nodes into the document.

### Issue: Preview not applying variables

**Fix:** Verify `applyVariablesToDocument()` is called and `sampleData` contains values:
```typescript
console.log("Sample Data:", sampleData);
console.log("Available Variables:", availableVariables);
```

## 📊 Performance Notes

- Variable scanning happens on save/preview (memoized)
- Sample data persisted to localStorage (per template)
- API calls made once on mount
- Block inspectors re-render only on active block change

## 🎯 What's Next (Phase 2)

- Variable chips (visual badges in text fields)
- Autocomplete dropdown on `{{` trigger
- Sample data editor modal
- 6 more block types (Three-Column, Order Summary, etc.)
- Onboarding tour
- Block validation warnings

## 📚 Additional Resources

- [@usewaypoint/email-builder docs](https://docs.usewaypoint.com)
- [Phase 1 Implementation Summary](./PHASE1_IMPLEMENTATION_SUMMARY.md)
- [Original Enhancement Plan](./Users/suhailjoo/.claude/plans/steady-weaving-turtle.md)
