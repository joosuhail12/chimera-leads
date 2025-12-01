import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createContact } from "@/lib/services/crm-contacts";

export async function POST(req: NextRequest) {
    const { userId, orgId } = await auth();
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const body = await req.json();
        const contact = await createContact(body, userId, orgId ?? userId);
        return NextResponse.json(contact);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
