import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { getContact } from "@/lib/services/crm-contacts";
import { EditableField } from "@/components/ui/editable-field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ActivityTimeline } from "@/components/crm/activity-timeline";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const user = await currentUser();

    if (!user) return null;

    try {
        const contact = await getContact(id);

        if (!contact) {
            notFound();
        }

        const contactPatchUrl = `/api/crm/contacts/${contact.id}`;

        // Placeholder for activities - in a real app we'd fetch these
        const activities: any[] = [];

        return (
            <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                    {/* Header */}
                    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                                    {contact.first_name} {contact.last_name}
                                </h1>
                                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    Contact
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {contact.title} {contact.account ? `at ${contact.account.name}` : ""}
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
                                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                            {contact.first_name?.charAt(0).toUpperCase()}{contact.last_name?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                                                {contact.first_name} {contact.last_name}
                                            </h2>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {contact.title ?? "No Title"}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <EditableField
                                            label="Email"
                                            value={contact.email}
                                            patchUrl={contactPatchUrl}
                                            payloadKey="email"
                                            placeholder="email@example.com"
                                            className="border-none bg-transparent p-0"
                                        />
                                        <EditableField
                                            label="Phone"
                                            value={contact.phone}
                                            patchUrl={contactPatchUrl}
                                            payloadKey="phone"
                                            placeholder="+1 555 0100"
                                            className="border-none bg-transparent p-0"
                                        />
                                        <EditableField
                                            label="LinkedIn"
                                            value={contact.linkedin_url}
                                            patchUrl={contactPatchUrl}
                                            payloadKey="linkedin_url"
                                            placeholder="LinkedIn URL"
                                            className="border-none bg-transparent p-0"
                                        />
                                        <EditableField
                                            label="Location"
                                            value={contact.location}
                                            patchUrl={contactPatchUrl}
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
                                    <TabsTrigger value="activity">Activity</TabsTrigger>
                                </TabsList>

                                <TabsContent value="overview">
                                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-50">
                                            Contact Details
                                        </h3>
                                        <div className="grid gap-6 md:grid-cols-2">
                                            <EditableField
                                                label="First Name"
                                                value={contact.first_name}
                                                patchUrl={contactPatchUrl}
                                                payloadKey="first_name"
                                            />
                                            <EditableField
                                                label="Last Name"
                                                value={contact.last_name}
                                                patchUrl={contactPatchUrl}
                                                payloadKey="last_name"
                                            />
                                            <div className="space-y-1">
                                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Account</span>
                                                <div className="text-sm text-gray-900 dark:text-gray-200">
                                                    {contact.account ? (
                                                        <Link href={`/dashboard/accounts/${contact.account.id}`} className="hover:text-sky-600 hover:underline">
                                                            {contact.account.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="text-gray-400">No Account</span>
                                                    )}
                                                </div>
                                            </div>
                                            <EditableField
                                                label="Job Title"
                                                value={contact.title}
                                                patchUrl={contactPatchUrl}
                                                payloadKey="title"
                                            />
                                            <EditableField
                                                label="Lifecycle Stage"
                                                value={contact.lifecycle_stage}
                                                patchUrl={contactPatchUrl}
                                                payloadKey="lifecycle_stage"
                                            />
                                            <EditableField
                                                label="Status"
                                                value={contact.status}
                                                patchUrl={contactPatchUrl}
                                                payloadKey="status"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="activity">
                                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                        <ActivityTimeline entityId={contact.id} entityType="contact" activities={activities} />
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </main>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error("Failed to load contact details", error);
        notFound();
    }
}
