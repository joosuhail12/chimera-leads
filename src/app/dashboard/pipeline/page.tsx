import { LeadsPipelineBoard } from "@/components/leads/pipeline-board";
import { fetchFromApi } from "@/lib/utils/fetch-from-api";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants/leads";

type PipelineResponse = {
  columns: Record<
    LeadStatus,
    Array<{
      id: string;
      name: string;
      company: string | null;
      email: string;
      status: LeadStatus;
      updated_at: string | null;
    }>
  >;
};

async function fetchPipeline(): Promise<PipelineResponse | null> {
  try {
    const response = await fetchFromApi("/api/leads/pipeline");

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as PipelineResponse;
  } catch (error) {
    console.error("Failed to load pipeline data", error);
    return null;
  }
}

export default async function PipelinePage() {
  const pipeline = await fetchPipeline();

  const columns =
    pipeline?.columns ??
    LEAD_STATUSES.reduce(
      (acc, status) => ({
        ...acc,
        [status.value]: [],
      }),
      {} as PipelineResponse["columns"]
    );

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
            Revenue pipeline
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Drag and drop leads between stages
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Every drop automatically updates the underlying Supabase record, so
            your team stays in sync.
          </p>
        </div>
      </header>

      <LeadsPipelineBoard columns={columns} />
    </div>
  );
}
