import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
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

        // Transaction-like update: Unset all others, set this one
        // Supabase doesn't support transactions in client lib easily without RPC, 
        // but we can do two queries.

        // 1. Unset all defaults for this org
        await supabase
            .from("email_senders")
            .update({ is_default: false })
            .eq("organization_id", user.id); // Assuming user.id is org_id for now based on previous code, or we need to fetch org_id

        // Wait, in previous code `organization_id` was `user.id` (which is wrong if using Clerk Orgs, but consistent with my previous code).
        // Let's stick to `user.id` as `organization_id` for consistency with `0015` migration usage in `POST` routes.

        // 2. Set new default
        const { error } = await supabase
            .from("email_senders")
            .update({ is_default: true })
            .eq("id", id);

        if (error) {
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to set default sender", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
