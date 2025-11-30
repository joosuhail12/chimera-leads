import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import dns from "dns";
import util from "util";

const resolveNs = util.promisify(dns.resolveNs);

export async function POST(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { domain } = await request.json();

        if (!domain) {
            return new NextResponse("Missing domain", { status: 400 });
        }

        let provider = "unknown";
        try {
            const nsRecords = await resolveNs(domain);
            const isCloudflare = nsRecords.some(ns => ns.toLowerCase().includes("cloudflare.com"));

            if (isCloudflare) {
                provider = "cloudflare";
            }
        } catch (error) {
            console.error("DNS Resolution failed", error);
            // Fallback to unknown if resolution fails (e.g. domain doesn't exist yet)
        }

        return NextResponse.json({ provider });
    } catch (error) {
        console.error("Failed to detect provider", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
