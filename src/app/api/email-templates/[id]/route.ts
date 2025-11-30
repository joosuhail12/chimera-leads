import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compileEmailTemplate } from "@/lib/email/compile-template";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Email template not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ template: data });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  const payload = (await request.json()) as {
    name?: string;
    description?: string;
    mjml?: string;
    html?: string;
    design?: unknown;
  };

  const updates: Record<string, unknown> = {};
  if (payload.name !== undefined) updates.name = payload.name;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.design !== undefined) updates.design_json = payload.design;

  if (payload.html !== undefined) {
    updates.html = payload.html;
    // If HTML is provided directly, we might want to clear AMP HTML or handle it if provided
    // For now, assuming direct HTML update doesn't provide AMP unless we add that too.
    // But if MJML is provided, it overwrites both.
  }

  if (payload.mjml !== undefined) {
    try {
      const compiled = compileEmailTemplate(payload.mjml);
      updates.html = compiled.html;
      updates.amp_html = compiled.ampHtml;
    } catch (error) {
      console.error("MJML compile failure", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to compile MJML template.",
        },
        { status: 400 }
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("email_templates")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to update email template", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update template." },
      { status: 400 }
    );
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete email template", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to delete template." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
