import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { AssignLeadButton } from "@/components/leads/assign-lead-button";
import { EditableField } from "@/components/ui/editable-field";
import { ActivityTimeline } from "@/components/crm/activity-timeline";
import { EmailComposer } from "@/components/crm/email-composer";
import { TaskList } from "@/components/crm/task-list";
import { SequenceEnrollmentDialog } from "@/components/sequences/enrollment-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEAD_STATUSES } from "@/lib/constants/leads";
import { fetchFromApi } from "@/lib/utils/fetch-from-api";
import { formatCustomFieldValue } from "@/lib/utils/format-custom-field-value";
import type { CustomFieldValueRow } from "@/lib/utils/format-custom-field-value";

export const dynamic = "force-dynamic";

type LeadRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string;
  status: string;
  message: string | null;
  current_solution: string | null;
  timeline: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  admin_notes: string | null;
  raw_payload: Record<string, unknown> | null;
};

type BookingRecord = {
  id: string;
  event_title: string | null;
  start_time: string | null;
  meeting_url: string | null;
  status: string | null;
};

type LeadCustomField = {
  id: string | null;
  name: string;
  field_key: string | null;
  field_type: string;
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
};

async function fetchLeadDetail(id: string) {
  try {
    const response = await fetchFromApi(`/api/leads/${id}`);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to load lead details");
    }

    return (await response.json()) as {
      lead: LeadRecord;
      bookings: BookingRecord[];
      customFields: LeadCustomField[];
      activities: any[];
      tasks: any[];
    };
  } catch (error) {
    console.error("Failed to load lead detail", error);
    return null;
  }
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, result] = await Promise.all([
    currentUser(),
    fetchLeadDetail(id),
  ]);

  if (!result) {
    notFound();
  }

  const { lead, bookings, customFields = [], activities = [], tasks = [] } = result as {
    lead: LeadRecord;
    bookings: BookingRecord[];
    customFields: LeadCustomField[];
    activities: any[];
    tasks: any[];
  };
  const bookingRecords = bookings ?? [];

  const rawPayload = lead.raw_payload ?? {};
  const linkedin =
    (rawPayload.linkedin as string | undefined) ??
    (rawPayload.LinkedIn as string | undefined) ??
    (rawPayload.linkedin_url as string | undefined) ??
    null;

  const systemActivities = [
    {
      id: "signup",
      type: "status_change",
      content: `Lead created for ${lead.company}`,
      occurred_at: lead.created_at,
      outcome: null,
      created_by: null,
    },
    ...bookingRecords.map((booking) => ({
      id: booking.id,
      type: "meeting",
      content: booking.meeting_url
        ? `Meeting link: ${booking.meeting_url}`
        : booking.status ?? "Calendar entry",
      outcome: null,
      occurred_at: booking.start_time ?? new Date().toISOString(),
      created_by: null,
    })),
  ];

  const allActivities = [...activities, ...systemActivities].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );

  const isAssignedToCurrentUser = !!user?.id && lead.assigned_to === user.id;
  const leadPatchUrl = `/api/leads/${lead.id}`;
  const statusOptions = LEAD_STATUSES.map((status) => ({
    label: status.label,
    value: status.value,
  }));

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
                {lead.name}
              </h1>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                Lead
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lead.company}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EditableField
              label="Status"
              value={lead.status}
              patchUrl={leadPatchUrl}
              payloadKey="status"
              type="select"
              options={statusOptions}
              className="min-w-[140px] bg-white dark:bg-gray-900"
            />
            <AssignLeadButton
              leadId={lead.id}
              isAssignedToCurrentUser={isAssignedToCurrentUser}
              assignedToLabel={lead.assigned_to}
            />
            <SequenceEnrollmentDialog
              leadId={lead.id}
              leadName={lead.name}
            />
            <EmailComposer leadId={lead.id} leadEmail={lead.email} />
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Contact Info Card */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg font-bold text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-50">
                      {lead.name}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {lead.company}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <EditableField
                    label="Email"
                    value={lead.email}
                    patchUrl={leadPatchUrl}
                    payloadKey="email"
                    placeholder="email@example.com"
                    displayMode="email"
                    className="border-none bg-transparent p-0"
                  />
                  <EditableField
                    label="Phone"
                    value={lead.phone}
                    patchUrl={leadPatchUrl}
                    payloadKey="phone"
                    placeholder="+1 555 0100"
                    className="border-none bg-transparent p-0"
                  />
                  {linkedin && (
                    <div className="text-sm">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        LinkedIn
                      </span>
                      <a
                        href={linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-sky-600 hover:underline dark:text-sky-400"
                      >
                        View Profile
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Fields Sidebar */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Custom Fields
                </h3>
                {customFields.length ? (
                  <dl className="space-y-4">
                    {customFields.map((field) => (
                      <div key={field.id ?? field.field_key ?? field.name}>
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {field.name}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 dark:text-gray-200">
                          {formatCustomFieldValue({
                            value_text: field.value_text,
                            value_number: field.value_number,
                            value_boolean: field.value_boolean,
                            value_date: field.value_date,
                            value_json: field.value_json,
                          } as CustomFieldValueRow)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-gray-500">No custom fields.</p>
                )}
              </div>

              {/* Tasks Sidebar */}
              <TaskList leadId={lead.id} tasks={tasks} />
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <Tabs defaultValue="overview">
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-6 text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Deal Context
                  </h3>
                  <div className="grid gap-6 md:grid-cols-2">
                    <EditableField
                      label="Company Name"
                      value={lead.company}
                      patchUrl={leadPatchUrl}
                      payloadKey="company"
                      placeholder="Acme Co."
                    />
                    <EditableField
                      label="Buying Timeline"
                      value={lead.timeline}
                      patchUrl={leadPatchUrl}
                      payloadKey="timeline"
                      placeholder="e.g. 2-3 months"
                    />
                    <EditableField
                      label="Current Solution"
                      value={lead.current_solution}
                      patchUrl={leadPatchUrl}
                      payloadKey="current_solution"
                      type="textarea"
                      className="md:col-span-2"
                      placeholder="Describe the tools they're using today"
                    />
                    <EditableField
                      label="Initial Message"
                      value={lead.message}
                      patchUrl={leadPatchUrl}
                      payloadKey="message"
                      type="textarea"
                      className="md:col-span-2"
                      placeholder="What did this lead ask for?"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <ActivityTimeline leadId={lead.id} activities={allActivities} />
                </div>
              </TabsContent>

              <TabsContent value="notes">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50">
                    Internal Notes
                  </h3>
                  <EditableField
                    label="Admin Notes"
                    value={lead.admin_notes}
                    patchUrl={leadPatchUrl}
                    payloadKey="admin_notes"
                    type="textarea"
                    placeholder="Document next steps, blockers, or anything helpful for teammates."
                    className="min-h-[200px]"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  );
}
