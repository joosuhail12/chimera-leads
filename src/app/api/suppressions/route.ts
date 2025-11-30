import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const payload = (await request.json()) as {
    suppressionListId?: string;
    audienceId?: string;
    email?: string;
    reason?: string;
    createdBy?: string;
  };

  if (!payload.audienceId && !payload.email) {
    return NextResponse.json(
      { error: "audienceId or email is required." },
      { status: 400 }
    );
  }

  let listId = payload.suppressionListId;
  if (!listId) {
    const { data: globalList } = await supabase
      .from("suppression_lists")
      .select("id")
      .eq("scope", "global")
      .eq("name", "Global Suppression")
      .limit(1)
      .single();
    listId = globalList?.id ?? null;
  }

  if (!listId) {
    return NextResponse.json(
      { error: "No suppression list available." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("suppression_entries")
    .insert({
      suppression_list_id: listId,
      audience_id: payload.audienceId ?? null,
      email: payload.email ?? null,
      reason: payload.reason ?? "Manually suppressed",
      created_by: payload.createdBy ?? null,
    })
    .select(
      "id, reason, created_at, suppression_list:suppression_lists(id,name,scope)"
    )
    .single();

  if (error || !data) {
    console.error("Failed to add suppression entry", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to add suppression entry." },
      { status: 400 }
    );
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
