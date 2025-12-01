import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateContact } from "@/lib/services/crm-contacts";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const contact = await updateContact(id, body);
        return NextResponse.json(contact);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
