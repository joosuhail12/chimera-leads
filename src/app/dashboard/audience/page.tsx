import Link from "next/link";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Audience | Chimera Dashboard",
};

export const revalidate = 0;

type AudienceRow = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  tags: string[] | null;
  customer_fit_score: number;
  utm_source: string | null;
  created_at: string;
};

export default async function AudiencePage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("audience")
    .select(
      "id,email,first_name,last_name,source,tags,customer_fit_score,utm_source,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load audience: ${error.message}`);
  }

  const audience = (data ?? []) as AudienceRow[];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Audience
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Newsletter contacts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search and inspect contacts captured via forms, waitlists, and imports.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">
            {audience.length.toLocaleString()} contacts
          </p>
          <p className="text-xs text-slate-500">
            Showing most recent {audience.length} captures
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Tags</th>
                <th className="px-6 py-3">Fit score</th>
                <th className="px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {audience.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/dashboard/audience/${contact.id}`}
                      className="flex flex-col text-slate-900 hover:text-sky-600"
                    >
                      <span className="font-semibold">
                        {contact.first_name || contact.last_name
                          ? `${contact.first_name ?? ""} ${
                              contact.last_name ?? ""
                            }`.trim()
                          : contact.email}
                      </span>
                      <span className="text-xs text-slate-500">
                        {contact.email}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {contact.source ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {contact.tags?.length ? contact.tags.join(", ") : "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {contact.customer_fit_score}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
