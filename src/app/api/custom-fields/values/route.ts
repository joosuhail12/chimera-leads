import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CustomEntityType,
  CustomFieldType,
  upsertCustomFieldValue,
} from "@/lib/services/custom-fields";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    definitionId?: string;
    entityId?: string;
    entityType?: CustomEntityType;
    value?: unknown;
    fieldType?: CustomFieldType;
  };

  if (!body.definitionId || !body.entityId || !body.entityType) {
    return NextResponse.json(
      { error: "definitionId, entityId, and entityType are required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let fieldType = body.fieldType;
  if (!fieldType) {
    const { data, error } = await supabase
      .from("custom_field_definitions")
      .select("field_type")
      .eq("id", body.definitionId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Custom field definition not found." },
        { status: 404 }
      );
    }
    fieldType = data.field_type as CustomFieldType;
  }

  try {
    await upsertCustomFieldValue(
      body.definitionId,
      body.entityId,
      body.entityType,
      body.value ?? null,
      fieldType,
      supabase
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to store custom field value.",
      },
      { status: 400 }
    );
  }
}
