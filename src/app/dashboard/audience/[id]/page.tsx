import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditableField } from "@/components/ui/editable-field";
import { SuppressionManager } from "@/components/audience/suppression-manager";
import { formatCustomFieldValue } from "@/lib/utils/format-custom-field-value";

type Params = {
  params: {
    id: string;
  };
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return {
    title: `Audience Contact ${params.id} | Chimera Dashboard`,
  };
}

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function AudienceDetailPage({ params }: Params) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audience")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !data) {
    console.error("Audience detail not found", { error, id: params.id });
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

  type SuppressionEntry = {
    id: string;
    reason: string | null;
    created_at: string;
    suppression_list?: { id: string; name: string; scope: string } | null;
  };

  const { data: customFieldValues } = await supabase
    .from("custom_field_values")
    .select(
      "value_text,value_number,value_boolean,value_date,value_json,definition:custom_field_definitions(name,field_key,field_type)"
    )
    .eq("entity_id", params.id)
    .eq("entity_type", "audience");

  const customFields = (customFieldValues as CustomFieldValue[] | null)?.map((row) => ({
    label: row.definition?.name ?? row.definition?.field_key ?? "Custom field",
    type: (row.definition?.field_type as string | undefined) ?? "text",
    value: row,
  })) ?? [];

  const { data: subscriptionPreferences } = await supabase
    .from("marketing_subscription_preferences")
    .select("*")
    .eq("audience_id", params.id)
    .single();

  const { data: suppressionEntries } = await supabase
    .from("suppression_entries")
    .select(
      "id,reason,created_at,suppression_list:suppression_lists(id,name,scope)"
    )
    .or(`audience_id.eq.${params.id},email.eq.${data.email}`)
    .order("created_at", { ascending: false });

  const preferences =
    subscriptionPreferences ?? {
      audience_id: data.id,
      email_status: "subscribed",
      sms_status: "subscribed",
      push_status: "subscribed",
      topics: [],
    };

  const patchUrl = `/api/audience/${data.id}`;
  const tagsAsCsv = data.tags?.join(", ") ?? "";
  const subscriptionPatchUrl = `/api/audience/${data.id}/subscriptions`;
  const subscriptionOptions = [
    { label: "Subscribed", value: "subscribed" },
    { label: "Transactional only", value: "transactional_only" },
    { label: "Unsubscribed", value: "unsubscribed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm">
        <Link
          href="/dashboard/audience"
          className="text-slate-500 transition hover:text-slate-900"
        >
          Audience
        </Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-900 font-medium">{data.email}</span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Contact
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {data.first_name || data.last_name
              ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim()
              : data.email}
          </h1>
          <p className="text-sm text-slate-500">{data.email}</p>
        </div>
        <div className="mt-6 grid gap-4 text-sm text-slate-600 md:grid-cols-2">
          <EditableField
            label="First name"
            value={data.first_name}
            patchUrl={patchUrl}
            payloadKey="first_name"
            placeholder="First name"
          />
          <EditableField
            label="Last name"
            value={data.last_name}
            patchUrl={patchUrl}
            payloadKey="last_name"
            placeholder="Last name"
          />
          <EditableField
            label="Email"
            value={data.email}
            patchUrl={patchUrl}
            payloadKey="email"
            placeholder="contact@example.com"
            displayMode="email"
          />
          <EditableField
            label="Source"
            value={data.source}
            patchUrl={patchUrl}
            payloadKey="source"
            placeholder="Landing page"
          />
          <EditableField
            label="UTM source"
            value={data.utm_source}
            patchUrl={patchUrl}
            payloadKey="utm_source"
            placeholder="Newsletter"
          />
          <EditableField
            label="Tags"
            value={tagsAsCsv}
            patchUrl={patchUrl}
            buildPayload={(raw) => ({
              tags: raw
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            })}
            displayMode="chips"
            helperText="Comma separated"
          />
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs uppercase tracking-[0.2em] text-slate-400 dark:border-gray-800 dark:bg-gray-900/60">
            <span>Customer fit score</span>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-gray-100">
              {data.customer_fit_score ?? "Unscored"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs uppercase tracking-[0.2em] text-slate-400 dark:border-gray-800 dark:bg-gray-900/60">
            <span>Created at</span>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-gray-100">
              {new Date(data.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Suppression status
          </h2>
        </div>
        <div className="mt-4">
          <SuppressionManager
            audienceId={data.id}
            email={data.email}
            entries={(suppressionEntries ?? []).map((entry) => ({
              ...entry,
              suppression_list: Array.isArray(entry.suppression_list)
                ? entry.suppression_list[0]
                : entry.suppression_list,
            })) as SuppressionEntry[]}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Subscription preferences
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <EditableField
            label="Email"
            value={preferences.email_status}
            patchUrl={subscriptionPatchUrl}
            buildPayload={(value) => ({
              email_status: value,
            })}
            type="select"
            options={subscriptionOptions}
            helperText="Marketing emails, nurture drips, announcements."
          />
          <EditableField
            label="SMS"
            value={preferences.sms_status}
            patchUrl={subscriptionPatchUrl}
            buildPayload={(value) => ({
              sms_status: value,
            })}
            type="select"
            options={subscriptionOptions}
            helperText="Transactional texts vs promotional alerts."
          />
          <EditableField
            label="Push"
            value={preferences.push_status}
            patchUrl={subscriptionPatchUrl}
            buildPayload={(value) => ({
              push_status: value,
            })}
            type="select"
            options={subscriptionOptions}
            helperText="In-app or mobile push notifications."
          />
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
            No custom data recorded for this contact yet.
          </p>
        )}
      </section>
    </div>
  );
}
