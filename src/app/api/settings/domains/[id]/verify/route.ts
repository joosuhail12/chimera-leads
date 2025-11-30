import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { GetEmailIdentityCommand } from "@aws-sdk/client-sesv2";
import { createClient } from "@/lib/supabase/server";
import { getSesClient } from "@/lib/email/ses-client";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { id } = await params;

        const supabase = await createClient();
        const { data: domainRecord, error: fetchError } = await supabase
            .from("email_domains")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !domainRecord) {
            return new NextResponse("Domain not found", { status: 404 });
        }

        // 1. Check Status in SES
        const ses = getSesClient();
        const command = new GetEmailIdentityCommand({
            EmailIdentity: domainRecord.domain,
        });

        const sesResponse = await ses.send(command);

        const isVerified = sesResponse.VerifiedForSendingStatus === true;
        const dkimStatus = sesResponse.DkimAttributes?.Status; // 'PENDING', 'SUCCESS', 'FAILED', 'TEMPORARY_FAILURE', 'NOT_STARTED'
        const dkimTokens = sesResponse.DkimAttributes?.Tokens || [];

        let status = "pending";
        if (isVerified) {
            status = "verified";
        } else if (dkimStatus === "SUCCESS") {
            status = "verified";
        } else if (dkimStatus) {
            status = dkimStatus.toLowerCase();
        }

        // 2. Update DB
        const { error: updateError } = await supabase
            .from("email_domains")
            .update({
                is_verified: isVerified || dkimStatus === "SUCCESS",
                status: status,
                dkim_tokens: dkimTokens,
                updated_at: new Date().toISOString(),
            })
            .eq("id", id);

        if (updateError) {
            return new NextResponse("Database Update Error", { status: 500 });
        }

        return NextResponse.json({
            success: true,
            isVerified,
            dkimStatus
        });
    } catch (error) {
        console.error("Failed to verify domain", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
