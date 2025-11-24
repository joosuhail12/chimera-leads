import { notFound } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { AssignLeadButton } from "@/components/leads/assign-lead-button";
import { LEAD_STATUSES } from "@/lib/constants/leads";
import { resolveBaseUrl } from "@/lib/utils/resolve-base-url";

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

async function fetchLeadDetail(id: string) {
  const baseUrl = resolveBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/leads/${id}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to load lead details");
    }

    return (await response.json()) as {
      lead: LeadRecord;
      bookings: BookingRecord[];
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

  const { lead, bookings } = result;
  const bookingRecords = bookings ?? [];

  const rawPayload = lead.raw_payload ?? {};
  const linkedin =
    (rawPayload.linkedin as string | undefined) ??
    (rawPayload.LinkedIn as string | undefined) ??
    (rawPayload.linkedin_url as string | undefined) ??
    null;
  const statusMeta = LEAD_STATUSES.find((s) => s.value === lead.status);

  const journeyEvents = [
    {
      title: "Signed up",
      timestamp: lead.created_at,
      description: `Lead created for ${lead.company}`,
    },
    ...bookingRecords.map((booking) => ({
      title: booking.event_title ?? "Meeting scheduled",
      timestamp: booking.start_time,
      description: booking.meeting_url
        ? `Meeting link: ${booking.meeting_url}`
        : booking.status ?? "Calendar entry",
    })),
    lead.admin_notes
      ? {
          title: "Admin notes updated",
          timestamp: lead.updated_at,
          description: lead.admin_notes,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    timestamp: string | null;
    description: string | null;
  }>;

  const isAssignedToCurrentUser = !!user?.id && lead.assigned_to === user.id;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
              Lead detail
            </p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-50">
              {lead.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lead.company}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-gray-200 px-4 py-1 text-sm font-semibold text-gray-600 dark:border-gray-800 dark:text-gray-300">
              {statusMeta?.label ?? lead.status}
            </span>
            <AssignLeadButton
              leadId={lead.id}
              isAssignedToCurrentUser={isAssignedToCurrentUser}
              assignedToLabel={lead.assigned_to}
            />
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Person */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            The Person
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Email</dt>
              <dd className="font-medium">{lead.email}</dd>
            </div>
            {lead.phone ? (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
                <dd className="font-medium">{lead.phone}</dd>
              </div>
            ) : null}
            {linkedin ? (
              <div>
                <dt className="text-gray-500 dark:text-gray-400">LinkedIn</dt>
                <dd>
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-chimera-teal hover:underline"
                  >
                    View profile
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Context */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            The Context
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Current solution
              </p>
              <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                {lead.current_solution ?? "Not provided"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-900/60">
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Buying timeline
              </p>
              <p className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                {lead.timeline ?? "Not specified"}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300">
            {lead.message ?? "This lead did not leave a message."}
          </div>
        </section>
      </div>

      {/* Journey */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          The Journey
        </h2>
        <div className="mt-4 space-y-6">
          {journeyEvents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No activity yet.
            </p>
          ) : (
            journeyEvents.map((event, index) => (
              <div key={`${event.title}-${index}`} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="h-3 w-3 rounded-full bg-chimera-teal" />
                  {index < journeyEvents.length - 1 ? (
                    <span className="mt-1 h-full w-px bg-gray-200 dark:bg-gray-800" />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {event.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {event.timestamp
                      ? new Date(event.timestamp).toLocaleString()
                      : "Date unknown"}
                  </p>
                  {event.description ? (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {event.description}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
