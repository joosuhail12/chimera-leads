import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import {
  verifyEmailOrDomain,
  checkVerificationStatus,
  getDomainDkimTokens,
} from "@/lib/email/ses-verification";

// POST: Trigger SES verification for email/domain
export async function POST(request: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { settingId } = await request.json();

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

    // Trigger verification based on whether it's an email or domain
    const identityToVerify = setting.domain || setting.from_email;
    const result = await verifyEmailOrDomain(identityToVerify);

    // Update the database with verification tokens if it's a domain
    if (result.type === "domain" && result.dkimTokens) {
      const { error: updateError } = await supabase
        .from("organization_email_settings")
        .update({
          verification_token: result.verificationToken,
          dkim_tokens: result.dkimTokens,
          spf_record: "v=spf1 include:amazonses.com ~all",
          updated_at: new Date().toISOString(),
        })
        .eq("id", settingId);

      if (updateError) {
        console.error("Error updating verification tokens:", updateError);
      }
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      message: result.type === "email"
        ? "Verification email sent. Please check your inbox."
        : "Domain verification initiated. Please add the DNS records.",
    });
  } catch (error) {
    console.error("Failed to trigger verification", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// GET: Check verification status from SES
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

    // Check verification status with SES
    const identityToCheck = setting.domain || setting.from_email;
    const status = await checkVerificationStatus(identityToCheck);

    // If it's a domain and now verified, also check DKIM status
    let dkimVerified = false;
    if (setting.domain && status.verified) {
      // In production, you would check individual DKIM record verification
      // For now, we'll assume DKIM is verified if the domain is verified
      dkimVerified = true;

      // Get fresh DKIM tokens if we don't have them
      if (!setting.dkim_tokens || setting.dkim_tokens.length === 0) {
        try {
          const dkimTokens = await getDomainDkimTokens(setting.domain);
          await supabase
            .from("organization_email_settings")
            .update({
              dkim_tokens: dkimTokens,
            })
            .eq("id", settingId);
        } catch (error) {
          console.error("Error fetching DKIM tokens:", error);
        }
      }
    }

    // Update the database with the verification status
    const { error: updateError } = await supabase
      .from("organization_email_settings")
      .update({
        is_verified: status.verified,
        verification_status: status.verified ? "verified" : status.status,
        dkim_verified: dkimVerified,
        spf_verified: status.verified, // Simplified: assume SPF is verified if domain is
        updated_at: new Date().toISOString(),
      })
      .eq("id", settingId);

    if (updateError) {
      console.error("Error updating verification status:", updateError);
    }

    return NextResponse.json({
      verified: status.verified,
      status: status.status,
      dkimVerified,
      spfVerified: status.verified,
    });
  } catch (error) {
    console.error("Failed to check verification status", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}