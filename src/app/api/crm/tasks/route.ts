import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
    try {
        const user = await currentUser();
        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const json = await request.json();
        const supabase = await createClient();

        const { error } = await supabase.from("crm_tasks").insert({
            ...json,
            created_by: user.id,
            assigned_to: user.id, // Default assignment to creator for now
        });

        if (error) {
            console.error(error);
            return new NextResponse("Database Error", { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
