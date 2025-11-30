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

  if ("first_name" in payload) updates.first_name = payload.first_name;
  if ("last_name" in payload) updates.last_name = payload.last_name;
  if ("email" in payload) updates.email = payload.email;
  if ("source" in payload) updates.source = payload.source;
  if ("utm_source" in payload) updates.utm_source = payload.utm_source;
  if ("tags" in payload) updates.tags = payload.tags;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("audience")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Audience update failed", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update audience." },
      { status: 400 }
    );
  }

  return NextResponse.json({ audience: data });
}
