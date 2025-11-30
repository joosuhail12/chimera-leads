import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");

        if (error) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=${error}`);
        }

        if (!code || !state) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=missing_params`);
        }

        let domainId: string;
        try {
            const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
            domainId = decodedState.domainId;
        } catch (e) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=invalid_state`);
        }

        // 1. Exchange Code for Token
        const tokenRes = await fetch("https://dash.cloudflare.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: process.env.CLOUDFLARE_CLIENT_ID!,
                client_secret: process.env.CLOUDFLARE_CLIENT_SECRET!,
                redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/cloudflare/callback`,
                code,
            }),
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.error("Cloudflare Token Exchange Failed", tokenData);
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=token_exchange_failed`);
        }

        const accessToken = tokenData.access_token;

        // 2. Fetch Domain Info from DB
        const supabase = await createClient();
        const { data: domainRecord, error: fetchError } = await supabase
            .from("email_domains")
            .select("*")
            .eq("id", domainId)
            .single();

        if (fetchError || !domainRecord) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=domain_not_found`);
        }

        const domain = domainRecord.domain;
        const dkimTokens = domainRecord.dkim_tokens || [];

        // 3. Find Zone ID
        const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${domain}`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        const zonesData = await zonesRes.json();

        if (!zonesData.success || zonesData.result.length === 0) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=zone_not_found`);
        }

        const zoneId = zonesData.result[0].id;

        // 4. Add CNAME Records
        const results = [];
        for (const token of dkimTokens) {
            const record = {
                type: "CNAME",
                name: `${token}._domainkey`,
                content: `${token}.dkim.amazonses.com`,
                ttl: 1,
                proxied: false
            };

            const addRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(record)
            });

            const addData = await addRes.json();
            results.push({ token, success: addData.success });
        }

        // 5. Verify Domain in our system immediately
        // We can call our verify endpoint logic here or just trigger it via fetch if we want to be lazy, 
        // but better to just update DB if we trust Cloudflare. 
        // Actually, let's just redirect with success and let the UI refresh.

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?success=cloudflare_connected`);

    } catch (error) {
        console.error("Cloudflare Callback Error", error);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/email?error=internal_error`);
    }
}
