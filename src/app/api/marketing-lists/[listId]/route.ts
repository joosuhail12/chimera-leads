import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MarketingListFilter,
  normalizeSlug,
  syncMarketingListMembers,
} from "@/lib/services/marketing-lists";

type Params = {
  params: {
    listId: string;
  };
};

export async function GET(_: NextRequest, { params }: Params) {
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
    .eq("id", params.listId)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Marketing list not found." },
      { status: 404 }
    );
  }

  const members = await supabase
    .from("marketing_list_members")
    .select("audience_id,audience:audience(id,email,first_name,last_name,tags,source)")
    .eq("list_id", params.listId)
    .order("added_at", { ascending: false })
    .limit(50);

  return NextResponse.json({
    list: {
      ...data,
      member_count:
        data.marketing_list_members?.[0]?.count ??
        data.marketing_list_members?.count ??
        0,
      preview_members: members.data ?? [],
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const payload = (await request.json()) as {
    name?: string;
    slug?: string;
    description?: string;
    filters?: MarketingListFilter;
    refreshMembers?: boolean;
    is_archived?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (payload.name) {
    updates.name = payload.name;
  }
  if (payload.slug) {
    updates.slug = normalizeSlug(payload.slug);
  }
  if (payload.description !== undefined) {
    updates.description = payload.description;
  }
  if (payload.filters !== undefined) {
    updates.filters = payload.filters;
  }
  if (payload.is_archived !== undefined) {
    updates.is_archived = payload.is_archived;
  }

  if (Object.keys(updates).length === 0 && !payload.refreshMembers) {
    return NextResponse.json(
      { error: "No updates supplied." },
      { status: 400 }
    );
  }

  let updatedList = null;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase
      .from("marketing_lists")
      .update(updates)
      .eq("id", params.listId)
      .select(
        "id,name,slug,description,filters,is_archived,last_refreshed_at,created_at,updated_at"
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to update marketing list." },
        { status: 400 }
      );
    }

    updatedList = data;
  }

  if (payload.refreshMembers || payload.filters) {
    const filters =
      (payload.filters as MarketingListFilter) ??
      (updatedList?.filters as MarketingListFilter) ??
      {};
    await syncMarketingListMembers(params.listId, filters, supabase);
  }

  return NextResponse.json({ success: true });
}
