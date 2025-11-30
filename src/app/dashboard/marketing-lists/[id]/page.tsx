import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { MemberTable } from "@/components/marketing-lists/member-table";

export default async function MarketingListDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: list, error } = await supabase
        .from("marketing_lists")
        .select("*")
        .eq("id", id)
        .single();

    if (error || !list) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">{list.name}</h1>
                    <p className="text-sm text-slate-500">{list.description || "No description provided."}</p>
                </div>
                <div className="flex gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                        {list.member_count} Members
                    </span>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Members</h2>
                <MemberTable listId={id} />
            </div>
        </div>
    );
}
