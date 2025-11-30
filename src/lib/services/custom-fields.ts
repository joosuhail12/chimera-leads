import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CustomEntityType =
  | "sales_leads"
  | "audience"
  | "startup_applications";

export type CustomFieldType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "multiselect"
  | "url"
  | "email"
  | "phone";

export type CustomFieldDefinition = {
  id: string;
  entity_type: CustomEntityType;
  name: string;
  field_key: string;
  description?: string | null;
  field_type: CustomFieldType;
  options: string[] | null;
  is_required: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCustomFieldDefinitions(
  entityType?: CustomEntityType,
  supabase: SupabaseClient = createAdminClient()
) {
  let query = supabase
    .from("custom_field_definitions")
    .select("*")
    .order("created_at", { ascending: false });

  if (entityType) {
    query = query.eq("entity_type", entityType);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load custom field definitions: ${error.message}`);
  }

  return data as CustomFieldDefinition[];
}

export async function deleteCustomFieldDefinition(
  definitionId: string,
  supabase: SupabaseClient = createAdminClient()
) {
  const { error } = await supabase
    .from("custom_field_definitions")
    .delete()
    .eq("id", definitionId);

  if (error) {
    throw new Error(`Failed to delete custom field definition: ${error.message}`);
  }
}

export async function upsertCustomFieldValue(
  definitionId: string,
  entityId: string,
  entityType: CustomEntityType,
  value: unknown,
  fieldType: CustomFieldType,
  supabase: SupabaseClient = createAdminClient()
) {
  const payload: Record<string, unknown> = {
    definition_id: definitionId,
    entity_id: entityId,
    entity_type: entityType,
    value_text: null,
    value_number: null,
    value_boolean: null,
    value_date: null,
    value_json: null,
  };

  switch (fieldType) {
    case "number":
      payload.value_number =
        typeof value === "number" ? value : Number(value ?? null);
      break;
    case "boolean":
      payload.value_boolean =
        typeof value === "boolean"
          ? value
          : value === "true"
          ? true
          : value === "false"
          ? false
          : null;
      break;
    case "date":
      payload.value_date =
        typeof value === "string" && value ? value : null;
      break;
    case "select":
      payload.value_text = typeof value === "string" ? value : String(value ?? "");
      break;
    case "multiselect":
      payload.value_json = Array.isArray(value)
        ? value
        : typeof value === "string"
        ? value.split(",").map((item) => item.trim())
        : [];
      break;
    default:
      payload.value_text = typeof value === "string" ? value : String(value ?? "");
  }

  const { error } = await supabase
    .from("custom_field_values")
    .upsert(payload, { onConflict: "definition_id,entity_id" });

  if (error) {
    throw new Error(`Failed to save custom field value: ${error.message}`);
  }
}
