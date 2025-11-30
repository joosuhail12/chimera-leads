import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditableField } from "@/components/ui/editable-field";
import { formatCustomFieldValue } from "@/lib/utils/format-custom-field-value";

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
export const dynamic = "force-dynamic";

export default async function StartupDetailPage({ params }: Params) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("startup_applications")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    console.error("Startup application not found", { error, id: params.id });
    notFound();
  }

  type CustomFieldValue = {
    value_text: string | null;
    value_number: number | null;
    value_boolean: boolean | null;
    value_date: string | null;
    value_json: unknown;
    definition: { name?: string | null; field_key?: string | null; field_type?: string | null } | null;
  };

  const { data: customFieldValues } = await supabase
    .from("custom_field_values")
    .select(
      "value_text,value_number,value_boolean,value_date,value_json,definition:custom_field_definitions(name,field_key,field_type)"
    )
    .eq("entity_id", params.id)
    .eq("entity_type", "startup_applications");

  const customFields = (customFieldValues as CustomFieldValue[] | null)?.map((row) => ({
    label: row.definition?.name ?? row.definition?.field_key ?? "Custom field",
    value: row,
  })) ?? [];

  const patchUrl = `/api/startups/${data.id}`;

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
        <div className="mt-6 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
          <EditableField
            label="Company name"
            value={data.company_name}
            patchUrl={patchUrl}
            payloadKey="company_name"
            placeholder="Acme Robotics"
          />
          <EditableField
            label="Contact email"
            value={data.email}
            patchUrl={patchUrl}
            payloadKey="email"
            placeholder="founder@example.com"
            displayMode="email"
          />
          <EditableField
            label="Status"
            value={data.status}
            patchUrl={patchUrl}
            payloadKey="status"
            placeholder="In review"
          />
          <EditableField
            label="Program tier"
            value={data.program_tier}
            patchUrl={patchUrl}
            payloadKey="program_tier"
            placeholder="Tier 1"
          />
          <EditableField
            label="Website"
            value={data.website}
            patchUrl={patchUrl}
            payloadKey="website"
            placeholder="https://example.com"
            displayMode="url"
          />
          <EditableField
            label="Use case"
            value={data.use_case}
            patchUrl={patchUrl}
            payloadKey="use_case"
            type="textarea"
            placeholder="Describe their use case"
          />
          <EditableField
            label="Seats needed"
            value={data.seats_needed}
            patchUrl={patchUrl}
            payloadKey="seats_needed"
            type="number"
            placeholder="10"
          />
          <EditableField
            label="Total funding"
            value={data.total_funding}
            patchUrl={patchUrl}
            payloadKey="total_funding"
            placeholder="$5M"
          />
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs uppercase tracking-[0.2em] text-slate-400 dark:border-gray-800 dark:bg-gray-900/60">
            <span>Submitted</span>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-gray-100">
              {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
        </div>
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
