import Link from "next/link";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@clerk/nextjs/server";
import { CreateContactSheet } from "@/components/crm/create-contact-sheet";

export const metadata: Metadata = {
    title: "Contacts | Chimera Dashboard",
};

export const revalidate = 0;

type ContactRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    account: {
        name: string;
    } | { name: string }[] | null;
    created_at: string;
};

export default async function ContactsPage() {
    const { userId, orgId } = await auth();
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from("sales_contacts")
        .select(`
      id, 
      first_name, 
      last_name, 
      email, 
      phone, 
      title, 
      created_at,
      account:sales_accounts(name)
    `)
        .order("created_at", { ascending: false })
        .limit(100);

    if (error) {
        throw new Error(`Failed to load contacts: ${error.message}`);
    }

    const contacts = (data ?? []) as ContactRow[];

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                        Sales
                    </p>
                    <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                        Contacts
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Manage people associated with your accounts.
                    </p>
                </div>
                <div>
                    {userId && <CreateContactSheet userId={userId} orgId={orgId ?? userId} />}
                </div>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {contacts.length.toLocaleString()} contacts
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Account</th>
                                <th className="px-6 py-3">Title</th>
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">Phone</th>
                                <th className="px-6 py-3">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {contacts.map((contact) => (
                                <tr
                                    key={contact.id}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
                                >
                                    <td className="px-6 py-3">
                                        <Link
                                            href={`/dashboard/contacts/${contact.id}`}
                                            className="flex flex-col text-slate-900 hover:text-sky-600 dark:text-slate-50 dark:hover:text-sky-400"
                                        >
                                            <span className="font-semibold">
                                                {contact.first_name} {contact.last_name}
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {Array.isArray(contact.account)
                                            ? contact.account[0]?.name ?? "—"
                                            : contact.account?.name ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {contact.title ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {contact.email ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {contact.phone ?? "—"}
                                    </td>
                                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                                        {new Date(contact.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {contacts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                        No contacts found.
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
