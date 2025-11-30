import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  const payload = (await request.json()) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  if ("company_name" in payload) updates.company_name = payload.company_name;
  if ("email" in payload) updates.email = payload.email;
  if ("status" in payload) updates.status = payload.status;
  if ("website" in payload) updates.website = payload.website;
  if ("program_tier" in payload) updates.program_tier = payload.program_tier;
  if ("use_case" in payload) updates.use_case = payload.use_case;
  if ("seats_needed" in payload) updates.seats_needed = payload.seats_needed;
  if ("total_funding" in payload) updates.total_funding = payload.total_funding;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("startup_applications")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Startup application update failed", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update startup application." },
      { status: 400 }
    );
  }

  return NextResponse.json({ startup: data });
}
