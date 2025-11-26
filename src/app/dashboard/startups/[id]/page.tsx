import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = {
  params: {
    id: string;
  };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return {
    title: `Startup Application ${params.id} | Chimera Dashboard`,
  };
}

export const revalidate = 0;

export default async function StartupDetailPage({ params }: Params) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("startup_applications")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    notFound();
  }

  const { data: customFieldValues } = await supabase
    .from("custom_field_values")
    .select(
      "value_text,value_number,value_boolean,value_date,value_json,definition:custom_field_definitions(name,field_key,field_type)"
    )
    .eq("entity_id", params.id)
    .eq("entity_type", "startup_applications");

  const customFields = (customFieldValues ?? []).map((row) => ({
    label: row.definition?.name ?? row.definition?.field_key ?? "Custom field",
    value: row,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/dashboard/startups"
          className="text-slate-500 transition hover:text-slate-900"
        >
          Startup Apps
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 font-medium">{data.company_name}</span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Company
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {data.company_name}
        </h1>
        <p className="text-sm text-slate-500">{data.email}</p>
        <dl className="mt-6 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Status
            </dt>
            <dd>{data.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Program tier
            </dt>
            <dd>{data.program_tier ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Website
            </dt>
            <dd>
              {data.website ? (
                <a
                  href={data.website.startsWith("http") ? data.website : `https://${data.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:underline"
                >
                  {data.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Seats needed
            </dt>
            <dd>{data.seats_needed ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Use case
            </dt>
            <dd>{data.use_case ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Total funding
            </dt>
            <dd>{data.total_funding ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Submitted
            </dt>
            <dd>{new Date(data.created_at).toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Custom fields
        </h2>
        {customFields.length ? (
          <dl className="mt-4 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
            {customFields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {field.label}
                </dt>
                <dd>{formatCustomFieldValue(field.value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No custom data recorded for this application yet.
          </p>
        )}
      </section>
    </div>
  );
}

function formatCustomFieldValue(row: {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
  value_json: unknown;
}) {
  if (row.value_text) return row.value_text;
  if (row.value_number !== null && row.value_number !== undefined) {
    return row.value_number.toString();
  }
  if (row.value_boolean !== null && row.value_boolean !== undefined) {
    return row.value_boolean ? "True" : "False";
  }
  if (row.value_date) {
    return new Date(row.value_date).toLocaleDateString();
  }
  if (row.value_json) {
    if (Array.isArray(row.value_json)) {
      return row.value_json.join(", ");
    }
    return JSON.stringify(row.value_json);
  }
  return "—";
}
