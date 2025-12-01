import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAccount } from "@/lib/services/crm-accounts";

export async function GET(req: NextRequest) {
    const { userId, orgId } = await auth();
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") ?? "100");

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_accounts")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(limit);

    if (error) {
        return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json({ accounts: data });
}

export async function POST(req: NextRequest) {
    const { userId, orgId } = await auth();
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const account = await createAccount(body, userId, orgId ?? userId); // Fallback to userId if no orgId
        return NextResponse.json(account);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
