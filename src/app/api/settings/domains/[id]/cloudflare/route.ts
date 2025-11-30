import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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
        const { apiToken } = await request.json();

        if (!apiToken) {
            return new NextResponse("Missing API Token", { status: 400 });
        }

        const supabase = await createClient();
        const { data: domainRecord, error: fetchError } = await supabase
            .from("email_domains")
            .select("*")
            .eq("id", id)
            .single();

        if (fetchError || !domainRecord) {
            return new NextResponse("Domain not found", { status: 404 });
        }

        const domain = domainRecord.domain;
        const dkimTokens = domainRecord.dkim_tokens || [];

        if (dkimTokens.length === 0) {
            return new NextResponse("No DKIM tokens found for this domain", { status: 400 });
        }

        // 1. Find Zone ID
        const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json"
            }
        });

        const zonesData = await zonesRes.json();

        if (!zonesData.success || zonesData.result.length === 0) {
            return new NextResponse("Cloudflare Zone not found or Token invalid", { status: 400 });
        }

        const zoneId = zonesData.result[0].id;

        // 2. Add CNAME Records
        const results = [];
        for (const token of dkimTokens) {
            const name = `${token}._domainkey`; // Cloudflare automatically appends domain if not fully qualified, but let's be safe. Actually Cloudflare prefers relative or full. Relative is safer if zone matches.
            // Wait, Cloudflare API expects 'name' to be the record name. 
            // If I pass "token._domainkey", it will be "token._domainkey.domain.com".

            const record = {
                type: "CNAME",
                name: `${token}._domainkey`,
                content: `${token}.dkim.amazonses.com`,
                ttl: 1, // Auto
                proxied: false // DKIM should NOT be proxied usually
            };

            const addRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(record)
            });

            const addData = await addRes.json();
            results.push({ token, success: addData.success, errors: addData.errors });
        }

        const allSuccess = results.every(r => r.success);

        if (!allSuccess) {
            return NextResponse.json({
                success: false,
                message: "Some records failed to add",
                details: results
            }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to add Cloudflare records", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
