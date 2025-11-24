"use client";

import { useState } from "react";

type WebsiteDataTabsProps = {
  leads: Array<{
    id: string;
    name: string;
    email: string;
    company: string;
    status: string;
    timeline: string | null;
    current_solution: string | null;
    utm_source: string | null;
    landing_page: string | null;
    created_at: string;
  }>;
  bookings: Array<{
    id: string;
    lead_email: string | null;
    event_title: string | null;
    start_time: string | null;
    timezone: string | null;
    meeting_url: string | null;
    status: string;
    created_at: string;
  }>;
  audience: Array<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    source: string | null;
    tags: string[] | null;
    customer_fit_score: number;
    utm_source: string | null;
    created_at: string;
  }>;
  startups: Array<{
    id: string;
    company_name: string;
    email: string;
    website: string;
    status: string;
    program_tier: string | null;
    total_funding: string | null;
    seats_needed: string | null;
    use_case: string | null;
    created_at: string;
  }>;
};

const TAB_KEYS = ["leads", "bookings", "audience", "startups"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export function WebsiteDataTabs({
  leads,
  bookings,
  audience,
  startups,
}: WebsiteDataTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("leads");

  const tabMeta: Record<
    TabKey,
    { label: string; description: string; rows: React.ReactNode }
  > = {
    leads: {
      label: "Leads",
      description: "Sales/contact submissions",
      rows: renderLeadRows(leads),
    },
    bookings: {
      label: "Bookings",
      description: "Demo meetings & calendar events",
      rows: renderBookingRows(bookings),
    },
    audience: {
      label: "Audience",
      description: "Newsletter & waitlist signups",
      rows: renderAudienceRows(audience),
    },
    startups: {
      label: "Startup Apps",
      description: "Accelerator / program applicants",
      rows: renderStartupRows(startups),
    },
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-4 dark:border-gray-800">
        <div className="flex flex-wrap gap-4">
          {TAB_KEYS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-2 py-3 text-left text-sm font-semibold ${
                activeTab === tab
                  ? "border-chimera-teal text-chimera-teal"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <div>{tabMeta[tab].label}</div>
              <div className="text-xs font-normal text-gray-400">
                {tabMeta[tab].description}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">{tabMeta[activeTab].rows}</div>
    </section>
  );
}

function TableShell({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
      <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
        <tr>
          {headers.map((header) => (
            <th key={header} className="px-4 py-3">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 text-sm text-gray-700 dark:divide-gray-800 dark:text-gray-200">
        {children}
      </tbody>
    </table>
  );
}

function renderLeadRows(leads: WebsiteDataTabsProps["leads"]) {
  return (
    <TableShell
      headers={[
        "Name",
        "Email",
        "Company",
        "Status",
        "Timeline",
        "Current Solution",
        "Source",
        "Ingested",
      ]}
    >
      {leads.length === 0 ? (
        <EmptyRow colSpan={8} />
      ) : (
        leads.map((lead) => (
          <tr key={lead.id}>
            <td className="px-4 py-3 font-medium">{lead.name}</td>
            <td className="px-4 py-3 text-gray-500">{lead.email}</td>
            <td className="px-4 py-3">{lead.company}</td>
            <td className="px-4 py-3 capitalize">{lead.status}</td>
            <td className="px-4 py-3 text-gray-500">
              {lead.timeline ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {lead.current_solution ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {lead.utm_source ?? lead.landing_page ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(lead.created_at).toLocaleString()}
            </td>
          </tr>
        ))
      )}
    </TableShell>
  );
}

function renderBookingRows(bookings: WebsiteDataTabsProps["bookings"]) {
  return (
    <TableShell
      headers={[
        "Event",
        "Lead Email",
        "Status",
        "Start Time",
        "Timezone",
        "Meeting Link",
        "Ingested",
      ]}
    >
      {bookings.length === 0 ? (
        <EmptyRow colSpan={7} />
      ) : (
        bookings.map((booking) => (
          <tr key={booking.id}>
            <td className="px-4 py-3 font-medium">
              {booking.event_title ?? "Meeting"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {booking.lead_email ?? "N/A"}
            </td>
            <td className="px-4 py-3 capitalize">{booking.status}</td>
            <td className="px-4 py-3 text-gray-500">
              {booking.start_time
                ? new Date(booking.start_time).toLocaleString()
                : "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {booking.timezone ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {booking.meeting_url ? (
                <a
                  href={booking.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-chimera-teal hover:underline"
                >
                  Link
                </a>
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(booking.created_at).toLocaleString()}
            </td>
          </tr>
        ))
      )}
    </TableShell>
  );
}

function renderAudienceRows(audience: WebsiteDataTabsProps["audience"]) {
  return (
    <TableShell
      headers={[
        "Email",
        "Name",
        "Source",
        "Tags",
        "Fit Score",
        "UTM Source",
        "Ingested",
      ]}
    >
      {audience.length === 0 ? (
        <EmptyRow colSpan={7} />
      ) : (
        audience.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 font-medium">{record.email}</td>
            <td className="px-4 py-3 text-gray-500">
              {(record.first_name ?? "") + " " + (record.last_name ?? "")}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {record.source ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {record.tags?.join(", ") ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {record.customer_fit_score}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {record.utm_source ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(record.created_at).toLocaleString()}
            </td>
          </tr>
        ))
      )}
    </TableShell>
  );
}

function renderStartupRows(startups: WebsiteDataTabsProps["startups"]) {
  return (
    <TableShell
      headers={[
        "Company",
        "Email",
        "Website",
        "Status",
        "Program Tier",
        "Seat Needs",
        "Use Case",
        "Ingested",
      ]}
    >
      {startups.length === 0 ? (
        <EmptyRow colSpan={8} />
      ) : (
        startups.map((record) => (
          <tr key={record.id}>
            <td className="px-4 py-3 font-medium">{record.company_name}</td>
            <td className="px-4 py-3 text-gray-500">{record.email}</td>
            <td className="px-4 py-3 text-gray-500">
              <a
                href={record.website}
                target="_blank"
                rel="noreferrer"
                className="text-chimera-teal hover:underline"
              >
                {record.website}
              </a>
            </td>
            <td className="px-4 py-3 capitalize">{record.status}</td>
            <td className="px-4 py-3 text-gray-500">
              {record.program_tier ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {record.seats_needed ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {record.use_case ?? "—"}
            </td>
            <td className="px-4 py-3 text-gray-500">
              {new Date(record.created_at).toLocaleString()}
            </td>
          </tr>
        ))
      )}
    </TableShell>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
      >
        Nothing has been ingested for this channel yet.
      </td>
    </tr>
  );
}
