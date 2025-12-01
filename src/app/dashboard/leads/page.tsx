import Link from "next/link";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
    title: "Leads | Chimera Dashboard",
};

export const revalidate = 0;

type LeadRow = {
    id: string;
    name: string;
    company: string;
    title: string | null;
    email: string;
    status: string;
    created_at: string;
    assigned_to: string | null;
};

export default async function LeadsPage() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_leads")
        .select("id, name, company, title, email, status, created_at, assigned_to")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        throw new Error(`Failed to load leads: ${error.message}`);
    }

    const leads = (data ?? []) as LeadRow[];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Sales
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                        Leads
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Manage your potential customers and track their status.
                    </p>
                </div>
                <div>
                    {/* Placeholder for Create Lead button - functionality to be added later */}
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Lead
                    </Button>
                </div>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {leads.length.toLocaleString()} leads
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Company</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Created</th>
                                <th className="px-6 py-3">Assigned</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {leads.map((lead) => (
                                <tr
                                    key={lead.id}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                                >
                                    <td className="px-6 py-3">
                                        <Link
                                            href={`/dashboard/leads/${lead.id}`}
                                            className="flex flex-col text-slate-900 hover:text-sky-600 dark:text-slate-50 dark:hover:text-sky-400"
                                        >
                                            <span className="font-semibold">{lead.name}</span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {lead.email}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {lead.company}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                                            {lead.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {new Date(lead.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {lead.assigned_to ?? "—"}
                                    </td>
                                </tr>
                            ))}
                            {leads.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                                        No leads found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
