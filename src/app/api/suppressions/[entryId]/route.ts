import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ entryId: string }>;
};

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { entryId } = await context.params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("suppression_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("Failed to delete suppression entry", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to delete entry." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
