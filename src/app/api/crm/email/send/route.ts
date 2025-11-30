import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { createClient } from "@/lib/supabase/server";
import { getSesClient } from "@/lib/email/ses-client";

export async function POST(request: Request) {
    try {
        const { userId, orgId } = await auth();
        if (!userId || !orgId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { leadId, to, subject, body } = await request.json();

        if (!leadId || !to || !subject || !body) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Get organization-specific email settings
        const supabase = await createClient();
        let fromEmail = process.env.AWS_FROM_EMAIL;
        let fromName: string | undefined;
        let replyToEmail: string | undefined;

        if (orgId) {
            const { data: emailSettings } = await supabase
                .from("organization_email_settings")
                .select("*")
                .eq("organization_id", orgId)
                .eq("is_verified", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (emailSettings) {
                fromEmail = emailSettings.from_email;
                fromName = emailSettings.from_name || undefined;
                replyToEmail = emailSettings.reply_to_email || undefined;
            }
        }

        if (!fromEmail) {
            return new NextResponse("No verified email address configured", { status: 500 });
        }

        // 1. Send Email via SES
        const ses = getSesClient();
        const command = new SendEmailCommand({
            FromEmailAddress: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
            ReplyToAddresses: replyToEmail ? [replyToEmail] : undefined,
            Destination: {
                ToAddresses: [to],
            },
            Content: {
                Simple: {
                    Subject: { Data: subject },
                    Body: {
                        Text: { Data: body },
                        // We could add HTML support here later
                    },
                },
            },
        });

        await ses.send(command);

        // 2. Log to CRM Activities
        const { error } = await supabase.from("crm_activities").insert({
            lead_id: leadId,
            type: "email",
            content: `Subject: ${subject}\n\n${body}`,
            outcome: "Sent",
            occurred_at: new Date().toISOString(),
            created_by: userId,
        });

        if (error) {
            console.error("Failed to log email activity", error);
            // We don't fail the request if logging fails, but we should probably alert
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to send email", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
