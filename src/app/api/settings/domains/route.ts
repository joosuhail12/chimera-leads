import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { CreateEmailIdentityCommand, GetEmailIdentityCommand } from "@aws-sdk/client-sesv2";
import { createClient } from "@/lib/supabase/server";
import { getSesClient } from "@/lib/email/ses-client";

export async function GET(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("email_domains")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ domains: data });
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { domain } = await request.json();

        if (!domain) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // 1. Create Identity in SES
        const ses = getSesClient();
        const command = new CreateEmailIdentityCommand({
            EmailIdentity: domain,
        });

        let dkimTokens: string[] = [];
        try {
            const sesResponse = await ses.send(command);
            dkimTokens = sesResponse.DkimAttributes?.Tokens || [];
        } catch (e: any) {
            // If it already exists, fetch the tokens
            if (e.name === 'AlreadyExistsException') {
                try {
                    const getCommand = new GetEmailIdentityCommand({ EmailIdentity: domain });
                    const getResponse = await ses.send(getCommand);
                    dkimTokens = getResponse.DkimAttributes?.Tokens || [];
                } catch (innerE) {
                    console.error("Failed to fetch existing identity", innerE);
                }
            } else {
                console.warn("SES Identity creation failed", e);
            }
        }

        // 2. Save to DB
        const supabase = await createClient();
        const { error } = await supabase.from("email_domains").insert({
            organization_id: user.id,
            domain,
            dkim_tokens: dkimTokens,
            status: "pending",
            created_by: user.id,
        });

        if (error) {
            console.error("DB Error", error);
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ success: true, dkimTokens });
    } catch (error) {
        console.error("Failed to add domain", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
