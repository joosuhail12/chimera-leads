import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants/leads";

const ALLOWED_STATUSES = new Set(
  LEAD_STATUSES.map((status) => status.value)
);

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const status = body.status as LeadStatus | undefined;

  if (!status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json(
      { error: "Invalid status value" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sales_leads")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update lead" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
