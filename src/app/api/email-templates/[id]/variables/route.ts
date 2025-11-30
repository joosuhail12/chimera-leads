import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCustomFieldDefinitions } from "@/lib/services/custom-fields";
import { extractVariables } from "@/lib/email/variable-parser";
import type { VariableDefinition } from "@/lib/email/variable-parser";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

/**
 * Built-in contact variables available for all templates
 */
const BUILT_IN_CONTACT_VARIABLES: VariableDefinition[] = [
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
    label: "Email Address",
    category: "contact",
    defaultValue: "",
    description: "Recipient's email address",
    exampleValue: "john.doe@example.com",
  },
  {
    key: "phone",
    label: "Phone Number",
    category: "contact",
    defaultValue: "",
    description: "Recipient's phone number",
    exampleValue: "+1 (555) 123-4567",
  },
  {
    key: "company",
    label: "Company",
    category: "contact",
    defaultValue: "",
    description: "Recipient's company name",
    exampleValue: "Acme Corporation",
  },
];

/**
 * Campaign-related variables
 */
const CAMPAIGN_VARIABLES: VariableDefinition[] = [
  {
    key: "campaign.name",
    label: "Campaign Name",
    category: "campaign",
    defaultValue: "",
    description: "Name of the marketing campaign",
    exampleValue: "Spring Sale 2025",
  },
  {
    key: "campaign.sendDate",
    label: "Send Date",
    category: "campaign",
    defaultValue: "",
    description: "Date the campaign is sent",
    exampleValue: new Date().toLocaleDateString(),
  },
];

/**
 * System variables (unsubscribe, preferences, etc.)
 */
const SYSTEM_VARIABLES: VariableDefinition[] = [
  {
    key: "unsubscribeUrl",
    label: "Unsubscribe URL",
    category: "system",
    defaultValue: "",
    description: "Link to unsubscribe from emails",
    exampleValue: "https://example.com/unsubscribe?token=abc123",
    isRequired: true,
  },
  {
    key: "preferencesUrl",
    label: "Preferences URL",
    category: "system",
    defaultValue: "",
    description: "Link to email preference center",
    exampleValue: "https://example.com/preferences?token=abc123",
  },
];

/**
 * GET /api/email-templates/[id]/variables
 * Fetch all available variables for a template
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminClient();

  // Fetch the template to check if it exists and get design_json
  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .select("design_json, subject_line, preheader_text")
    .eq("id", id)
    .single();

  if (templateError || !template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  try {
    // Fetch custom field definitions
    const customFieldDefs = await listCustomFieldDefinitions();

    // Transform custom fields into variable definitions
    const customFieldVariables: VariableDefinition[] = customFieldDefs.map(
      (def) => ({
        key: `custom.${def.field_key}`,
        label: def.name,
        category: "custom" as const,
        defaultValue: "",
        description: def.description || undefined,
        exampleValue: getExampleValueForFieldType(def.field_type),
      })
    );

    // Extract variables actually used in the template
    const usedVariables = new Set<string>();

    // Scan design_json for variables
    if (template.design_json) {
      const designStr = JSON.stringify(template.design_json);
      extractVariables(designStr).forEach((v) => usedVariables.add(v));
    }

    // Scan subject line for variables
    if (template.subject_line) {
      extractVariables(template.subject_line).forEach((v) =>
        usedVariables.add(v)
      );
    }

    // Scan preheader for variables
    if (template.preheader_text) {
      extractVariables(template.preheader_text).forEach((v) =>
        usedVariables.add(v)
      );
    }

    // Return all available variables
    return NextResponse.json({
      variables: {
        builtIn: BUILT_IN_CONTACT_VARIABLES,
        customFields: customFieldVariables,
        campaign: CAMPAIGN_VARIABLES,
        system: SYSTEM_VARIABLES,
      },
      usedInTemplate: Array.from(usedVariables),
    });
  } catch (error) {
    console.error("Error fetching variables:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch variables",
      },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get example value based on field type
 */
function getExampleValueForFieldType(fieldType: string): string {
  switch (fieldType) {
    case "text":
      return "Sample text";
    case "number":
      return "42";
    case "boolean":
      return "true";
    case "date":
      return new Date().toISOString().split("T")[0];
    case "select":
      return "Option 1";
    case "multiselect":
      return "Option 1, Option 2";
    default:
      return "Sample value";
  }
}
