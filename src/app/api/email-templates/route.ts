import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { compileEmailTemplate } from "@/lib/email/compile-template";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to load email templates", error);
    return NextResponse.json(
      { error: "Failed to load email templates." },
      { status: 500 }
    );
  }

  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const payload = (await request.json()) as {
    name?: string;
    description?: string;
    mjml?: string;
    html?: string;
    design?: unknown;
    createdBy?: string;
  };

  if (!payload.name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  if (!payload.mjml && !payload.html) {
    return NextResponse.json(
      { error: "Either MJML or HTML payload is required." },
      { status: 400 }
    );
  }

  let htmlContent = payload.html;
  let ampHtmlContent = null;

  if (payload.mjml) {
    try {
      const compiled = compileEmailTemplate(payload.mjml);
      htmlContent = compiled.html;
      ampHtmlContent = compiled.ampHtml;
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

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: payload.name,
      description: payload.description ?? null,
      html: htmlContent,
      amp_html: ampHtmlContent,
      design_json: payload.design ?? null,
      created_by: payload.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create email template", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to create email template." },
      { status: 400 }
    );
  }

  return NextResponse.json({ template: data }, { status: 201 });
}
