import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AudiencePreview = {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    customer_fit_score: number | null;
    status: string | null;
    created_at: string;
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const offset = (page - 1) * limit;

    const supabase = createAdminClient();

    // Fetch members via the junction table
    const { data: members, error, count } = await supabase
        .from("marketing_list_members")
        .select(
            `
      audience_id,
      audience:audience_id (
        id,
        email,
        first_name,
        last_name,
        customer_fit_score,
        status,
        created_at
      )
    `,
            { count: "exact" }
        )
        .eq("marketing_list_id", id)
        .range(offset, offset + limit - 1);

    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }

    // Flatten the response
    const flattenedMembers = (members ?? []).map((row) => {
        const audience = Array.isArray(row.audience) ? row.audience[0] : row.audience;
        return audience as AudiencePreview;
    });

    return NextResponse.json({
        members: flattenedMembers,
        total: count,
        page,
        totalPages: count ? Math.ceil(count / limit) : 0,
    });
}
