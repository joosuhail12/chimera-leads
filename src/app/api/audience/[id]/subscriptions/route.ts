import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("marketing_subscription_preferences")
    .select("*")
    .eq("audience_id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Failed to load subscription preferences", error);
    return NextResponse.json(
      { error: "Failed to load subscription preferences." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    preferences: data ?? {
      audience_id: id,
      email_status: "subscribed",
      sms_status: "subscribed",
      push_status: "subscribed",
      topics: [],
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  const payload = (await request.json()) as {
    email_status?: string;
    sms_status?: string;
    push_status?: string;
    topics?: unknown;
  };

  const allowedStatuses = ["subscribed", "unsubscribed", "transactional_only"];
  const updates: Record<string, unknown> = {};

  if (payload.email_status && allowedStatuses.includes(payload.email_status)) {
    updates.email_status = payload.email_status;
  }
  if (payload.sms_status && allowedStatuses.includes(payload.sms_status)) {
    updates.sms_status = payload.sms_status;
  }
  if (payload.push_status && allowedStatuses.includes(payload.push_status)) {
    updates.push_status = payload.push_status;
  }
  if (payload.topics) {
    updates.topics = payload.topics;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid updates supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("marketing_subscription_preferences")
    .upsert(
      {
        audience_id: id,
        ...updates,
      },
      { onConflict: "audience_id" }
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to save subscription preferences", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to save preferences." },
      { status: 400 }
    );
  }

  return NextResponse.json({ preferences: data });
}
