import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { DeleteEmailIdentityCommand } from "@aws-sdk/client-sesv2";
import { createClient } from "@/lib/supabase/server";
import { getSesClient } from "@/lib/email/ses-client";

export async function DELETE(
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

        // 1. Get domain name to delete from SES
        const { data: domainRecord, error: fetchError } = await supabase
            .from("email_domains")
            .select("domain")
            .eq("id", id)
            .single();

        if (fetchError || !domainRecord) {
            return new NextResponse("Domain not found", { status: 404 });
        }

        // 2. Delete from SES
        const ses = getSesClient();
        try {
            const command = new DeleteEmailIdentityCommand({
                EmailIdentity: domainRecord.domain,
            });
            await ses.send(command);
        } catch (e) {
            console.error("Failed to delete from SES", e);
            // Continue to delete from DB even if SES fails (might already be gone)
        }

        // 3. Delete from DB (Cascade will handle senders)
        const { error: deleteError } = await supabase
            .from("email_domains")
            .delete()
            .eq("id", id);

        if (deleteError) {
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete domain", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
