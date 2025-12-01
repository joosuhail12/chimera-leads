import Link from "next/link";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { CreateAccountSheet } from "@/components/crm/create-account-sheet";

export const metadata: Metadata = {
    title: "Accounts | Chimera Dashboard",
};

export const revalidate = 0;

type AccountRow = {
    id: string;
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    location: string | null;
    created_at: string;
};

export default async function AccountsPage() {
    const { userId, orgId } = await auth();
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_accounts")
        .select("id, name, domain, industry, size, location, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        throw new Error(`Failed to load accounts: ${error.message}`);
    }

    const accounts = (data ?? []) as AccountRow[];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Sales
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                        Accounts
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Manage organizations and companies.
                    </p>
                </div>
                <div>
                    {userId && <CreateAccountSheet userId={userId} orgId={orgId ?? userId} />}
                </div>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {accounts.length.toLocaleString()} accounts
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Domain</th>
                                <th className="px-6 py-3">Industry</th>
                                <th className="px-6 py-3">Size</th>
                                <th className="px-6 py-3">Location</th>
                                <th className="px-6 py-3">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {accounts.map((account) => (
                                <tr
                                    key={account.id}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                                >
                                    <td className="px-6 py-3">
                                        <Link
                                            href={`/dashboard/accounts/${account.id}`}
                                            className="flex flex-col text-slate-900 hover:text-sky-600 dark:text-slate-50 dark:hover:text-sky-400"
                                        >
                                            <span className="font-semibold">{account.name}</span>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {account.domain ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {account.industry ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {account.size ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {account.location ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {new Date(account.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {accounts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        No accounts found.
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
