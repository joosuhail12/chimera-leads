import { fetchFromApi } from "@/lib/utils/fetch-from-api";
import { WebsiteDataTabs } from "@/components/website-data/tabs";
import { KnockWorkflowTrigger } from "@/components/notifications/workflow-trigger";

type WebsiteData = {
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
    referrer: string | null;
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

async function loadWebsiteData(): Promise<WebsiteData | null> {
  try {
    const response = await fetchFromApi("/api/website-data");
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as WebsiteData;
  } catch (error) {
    console.error("Failed to load website data", error);
    return null;
  }
}

export default async function WebsiteDataPage() {
  const data = await loadWebsiteData();
  const leads = data?.leads ?? [];
  const bookings = data?.bookings ?? [];
  const audience = data?.audience ?? [];
  const startups = data?.startups ?? [];
  const knockConfigured =
    !!process.env.KNOCK_API_KEY &&
    !!process.env.NEXT_PUBLIC_KNOCK_PUBLIC_API_KEY &&
    !!process.env.NEXT_PUBLIC_KNOCK_FEED_CHANNEL_ID;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
            Website data
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Ingested submissions by channel
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse every inbound event captured via the webhook pipeline. Data
            is sorted by ingestion time (newest first).
          </p>
        </div>
      </header>

      {knockConfigured ? <KnockWorkflowTrigger /> : null}

      <WebsiteDataTabs
        leads={leads}
        bookings={bookings}
        audience={audience}
        startups={startups}
      />
    </div>
  );
}
