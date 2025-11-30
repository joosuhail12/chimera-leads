import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

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

        const { error } = await supabase
            .from("email_senders")
            .delete()
            .eq("id", id);

        if (error) {
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete sender", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
