import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CustomEntityType,
  CustomFieldType,
  listCustomFieldDefinitions,
} from "@/lib/services/custom-fields";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entityType = request.nextUrl.searchParams.get(
    "entityType"
  ) as CustomEntityType | null;

  try {
    const definitions = await listCustomFieldDefinitions(entityType || undefined);
    return NextResponse.json({ definitions });
  } catch (error) {
    console.error("Error loading custom fields:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load custom fields.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    entityType?: CustomEntityType;
    name?: string;
    fieldKey?: string;
    description?: string;
    fieldType?: CustomFieldType;
    options?: string[];
    isRequired?: boolean;
  };

  if (!body.entityType || !body.name) {
    return NextResponse.json(
      { error: "entityType and name are required." },
      { status: 400 }
    );
  }

  const fieldKey =
    body.fieldKey ??
    body.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("custom_field_definitions")
    .insert({
      entity_type: body.entityType,
      name: body.name,
      field_key: fieldKey,
      description: body.description,
      field_type: body.fieldType ?? "text",
      options: body.options ?? [],
      is_required: Boolean(body.isRequired),
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create custom field." },
      { status: 400 }
    );
  }

  return NextResponse.json({ definition: data }, { status: 201 });
}
