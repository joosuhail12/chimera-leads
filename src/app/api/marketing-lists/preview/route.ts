import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
    MarketingListFilter,
    previewMarketingListCount,
} from "@/lib/services/marketing-lists";

export async function POST(request: NextRequest) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = (await request.json()) as { filters: MarketingListFilter };
        const count = await previewMarketingListCount(body.filters);
        return NextResponse.json({ count });
    } catch (error) {
        console.error("Error previewing marketing list:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to preview marketing list.",
            },
            { status: 500 }
        );
    }
}
