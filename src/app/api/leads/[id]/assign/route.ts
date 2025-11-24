import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("sales_leads")
    .update({ assigned_to: userId })
    .eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to assign lead" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
