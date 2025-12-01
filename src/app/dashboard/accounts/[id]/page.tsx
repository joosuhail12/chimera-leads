import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import {
    getAccount,
    getAccountContacts,
    getAccountLeads
} from "@/lib/services/crm-accounts";
import { EditableField } from "@/components/ui/editable-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await currentUser();

    if (!user) return null;

    try {
        const [account, contacts, leads] = await Promise.all([
            getAccount(id),
            getAccountContacts(id),
            getAccountLeads(id)
        ]);

        if (!account) {
            notFound();
        }

        const accountPatchUrl = `/api/crm/accounts/${account.id}`; // We need to create this route or handle it

        return (
            <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    {/* Header */}
                    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                                    {account.name}
                                </h1>
                                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    Account
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {account.domain ?? "No domain"}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Actions like Edit, Delete could go here */}
                        </div>
                    </header>

                    <div className="grid gap-8 lg:grid-cols-4">
                        {/* Sidebar */}
                        <aside className="lg:col-span-1">
                            <div className="sticky top-8 space-y-6">
                                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <div className="mb-4 flex items-center gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                            {account.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                                                {account.name}
                                            </h2>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {account.industry ?? "Unknown Industry"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <EditableField
                                            label="Website"
                                            value={account.website}
                                            patchUrl={accountPatchUrl}
                                            payloadKey="website"
                                            placeholder="https://example.com"
                                            className="border-none bg-transparent p-0"
                                        />
                                        <EditableField
                                            label="LinkedIn"
                                            value={account.linkedin_url}
                                            patchUrl={accountPatchUrl}
                                            payloadKey="linkedin_url"
                                            placeholder="LinkedIn URL"
                                            className="border-none bg-transparent p-0"
                                        />
                                        <EditableField
                                            label="Location"
                                            value={account.location}
                                            patchUrl={accountPatchUrl}
                                            payloadKey="location"
                                            placeholder="City, Country"
                                            className="border-none bg-transparent p-0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* Main Content */}
                        <main className="lg:col-span-3">
                            <Tabs defaultValue="overview">
                                <TabsList className="mb-6">
                                    <TabsTrigger value="overview">Overview</TabsTrigger>
                                    <TabsTrigger value="contacts">Contacts ({contacts?.length ?? 0})</TabsTrigger>
                                    <TabsTrigger value="deals">Deals ({leads?.length ?? 0})</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview">
                                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-50">
                                            Company Details
                                        </h3>
                                        <div className="grid gap-6 md:grid-cols-2">
                                            <EditableField
                                                label="Account Name"
                                                value={account.name}
                                                patchUrl={accountPatchUrl}
                                                payloadKey="name"
                                            />
                                            <EditableField
                                                label="Domain"
                                                value={account.domain}
                                                patchUrl={accountPatchUrl}
                                                payloadKey="domain"
                                            />
                                            <EditableField
                                                label="Industry"
                                                value={account.industry}
                                                patchUrl={accountPatchUrl}
                                                payloadKey="industry"
                                            />
                                            <EditableField
                                                label="Company Size"
                                                value={account.size}
                                                patchUrl={accountPatchUrl}
                                                payloadKey="size"
                                            />
                                            <EditableField
                                                label="Annual Revenue"
                                                value={account.annual_revenue}
                                                patchUrl={accountPatchUrl}
                                                payloadKey="annual_revenue"
                                            />
                                            <EditableField
                                                label="Description"
                                                value={account.description}
                                                patchUrl={accountPatchUrl}
                                                payloadKey="description"
                                                type="textarea"
                                                className="md:col-span-2"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="contacts">
                                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                                                Contacts
                                            </h3>
                                            <Button size="sm" variant="outline">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Contact
                                            </Button>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {contacts?.map((contact: any) => (
                                                <div key={contact.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <div>
                                                        <Link href={`/dashboard/contacts/${contact.id}`} className="font-medium text-gray-900 hover:text-sky-600 dark:text-gray-50 dark:hover:text-sky-400">
                                                            {contact.first_name} {contact.last_name}
                                                        </Link>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {contact.title}
                                                        </p>
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {contact.email}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!contacts || contacts.length === 0) && (
                                                <div className="px-6 py-8 text-center text-gray-500">
                                                    No contacts associated with this account.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="deals">
                                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
                                            <h3 className="font-semibold text-gray-900 dark:text-gray-50">
                                                Deals (Leads)
                                            </h3>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {leads?.map((lead: any) => (
                                                <div key={lead.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                    <div>
                                                        <Link href={`/dashboard/leads/${lead.id}`} className="font-medium text-gray-900 hover:text-sky-600 dark:text-gray-50 dark:hover:text-sky-400">
                                                            {lead.name}
                                                        </Link>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Status: {lead.status}
                                                        </p>
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                                        {new Date(lead.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!leads || leads.length === 0) && (
                                                <div className="px-6 py-8 text-center text-gray-500">
                                                    No deals associated with this account.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </main>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error("Failed to load account details", error);
        notFound();
    }
}
