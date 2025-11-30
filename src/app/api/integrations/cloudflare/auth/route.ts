import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const domainId = searchParams.get("domainId");

        if (!domainId) {
            return new NextResponse("Missing domainId", { status: 400 });
        }

        const clientId = process.env.CLOUDFLARE_CLIENT_ID;
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/cloudflare/callback`;

        // State should ideally be signed/encrypted to prevent tampering, 
        // but for now we'll just pass the domainId and userId.
        const state = JSON.stringify({ domainId, userId: user.id });
        const encodedState = Buffer.from(state).toString('base64');

        const scope = "zones:read records:edit"; // Adjust scopes as needed

        const authUrl = `https://dash.cloudflare.com/oauth2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodedState}`;

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("Failed to initiate Cloudflare OAuth", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
