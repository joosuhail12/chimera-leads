import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getDomainDkimTokens } from "@/lib/email/ses-verification";

// GET: Fetch DNS records (DKIM tokens) from SES
export async function GET(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const settingId = searchParams.get("settingId");

    if (!settingId) {
      return new NextResponse("Missing setting ID", { status: 400 });
    }

    const supabase = await createClient();

    // Get the email setting
    const { data: setting, error: fetchError } = await supabase
      .from("organization_email_settings")
      .select("*")
      .eq("id", settingId)
      .single();

    if (fetchError || !setting) {
      return new NextResponse("Email setting not found", { status: 404 });
    }

    // Verify user has access to this organization
    if (setting.organization_id !== orgId) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    if (!setting.domain) {
      return new NextResponse("No domain configured for this email", { status: 400 });
    }

    // Fetch DKIM tokens from SES
    const dkimTokens = await getDomainDkimTokens(setting.domain);

    // Update the database with the tokens
    const { error: updateError } = await supabase
      .from("organization_email_settings")
      .update({
        dkim_tokens: dkimTokens,
        spf_record: "v=spf1 include:amazonses.com ~all",
        updated_at: new Date().toISOString(),
      })
      .eq("id", settingId);

    if (updateError) {
      console.error("Error updating DKIM tokens:", updateError);
    }

    return NextResponse.json({
      domain: setting.domain,
      dkimTokens,
      spfRecord: "v=spf1 include:amazonses.com ~all",
      dkimRecords: dkimTokens.map((token) => ({
        name: `${token}._domainkey.${setting.domain}`,
        type: "CNAME",
        value: `${token}.dkim.amazonses.com`,
      })),
      spfRecordDetails: {
        name: setting.domain,
        type: "TXT",
        value: "v=spf1 include:amazonses.com ~all",
      },
    });
  } catch (error) {
    console.error("Failed to fetch DNS records", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}