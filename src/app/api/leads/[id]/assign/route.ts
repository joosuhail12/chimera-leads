import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("sales_leads")
    .update({ assigned_to: userId })
    .eq("id", params.id);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to assign lead" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
