import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteCustomFieldDefinition } from "@/lib/services/custom-fields";

type Params = {
  params: {
    definitionId: string;
  };
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};

  if (body.name) {
    updates.name = body.name;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.fieldType) {
    updates.field_type = body.fieldType;
  }
  if (body.options) {
    updates.options = body.options;
  }
  if (body.isRequired !== undefined) {
    updates.is_required = Boolean(body.isRequired);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("custom_field_definitions")
    .update(updates)
    .eq("id", params.definitionId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update custom field." },
      { status: 400 }
    );
  }

  return NextResponse.json({ definition: data });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteCustomFieldDefinition(params.definitionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete custom field.",
      },
      { status: 400 }
    );
  }
}
