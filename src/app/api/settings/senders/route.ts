import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const supabase = await createClient();
        const { data, error } = await supabase
            .from("email_senders")
            .select("*, domain:email_domains(domain)")
            .order("created_at", { ascending: false });

        if (error) {
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ senders: data });
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

        const { domainId, localPart, fromName } = await request.json();

        if (!domainId || !localPart || !fromName) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const supabase = await createClient();

        // Get domain to construct email
        const { data: domainRecord } = await supabase
            .from("email_domains")
            .select("domain")
            .eq("id", domainId)
            .single();

        if (!domainRecord) {
            return new NextResponse("Domain not found", { status: 404 });
        }

        const email = `${localPart}@${domainRecord.domain}`;

        const { error } = await supabase.from("email_senders").insert({
            organization_id: user.id,
            domain_id: domainId,
            email,
            from_name: fromName,
            created_by: user.id,
        });

        if (error) {
            console.error("DB Error", error);
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to add sender", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
