import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MarketingListFilter,
  normalizeSlug,
  syncMarketingListMembers,
} from "@/lib/services/marketing-lists";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("marketing_lists")
    .select(
      "id,name,slug,description,filters,is_archived,last_refreshed_at,created_at,updated_at,marketing_list_members(count)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load marketing lists." },
      { status: 500 }
    );
  }

  const lists =
    data?.map((list) => ({
      id: list.id,
      name: list.name,
      slug: list.slug,
      description: list.description,
      filters: list.filters,
      is_archived: list.is_archived,
      last_refreshed_at: list.last_refreshed_at,
      created_at: list.created_at,
      updated_at: list.updated_at,
      member_count:
        list.marketing_list_members?.[0]?.count ??
        list.marketing_list_members?.count ??
        0,
    })) ?? [];

  return NextResponse.json({ lists });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    name?: string;
    slug?: string;
    description?: string;
    filters?: MarketingListFilter;
  };

  if (!payload.name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const slug = payload.slug
    ? normalizeSlug(payload.slug)
    : normalizeSlug(payload.name);

  const { data, error } = await supabase
    .from("marketing_lists")
    .insert({
      name: payload.name,
      slug,
      description: payload.description,
      filters: payload.filters ?? {},
      created_by: userId,
    })
    .select(
      "id,name,slug,description,filters,is_archived,last_refreshed_at,created_at,updated_at"
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Failed to create marketing list." },
      { status: 400 }
    );
  }

  const { memberCount } = await syncMarketingListMembers(
    data.id,
    (data.filters as MarketingListFilter) ?? {},
    supabase
  );

  return NextResponse.json(
    {
      list: {
        ...data,
        member_count: memberCount,
      },
    },
    { status: 201 }
  );
}
