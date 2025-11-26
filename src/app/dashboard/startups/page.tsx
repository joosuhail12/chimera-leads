import Link from "next/link";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Startup Applications | Chimera Dashboard",
};

export const revalidate = 0;

type StartupRow = {
  id: string;
  company_name: string;
  email: string;
  website: string | null;
  status: string;
  program_tier: string | null;
  total_funding: string | null;
  seats_needed: string | null;
  use_case: string | null;
  created_at: string;
};

export default async function StartupApplicationsPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("startup_applications")
    .select(
      "id,company_name,email,website,status,program_tier,total_funding,seats_needed,use_case,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to load startup applications: ${error.message}`);
  }

  const startups = (data ?? []) as StartupRow[];

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Applications
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Startup pipeline
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Review recent applications, track status, and click through for full
          dossiers.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">
            {startups.length.toLocaleString()} applications
          </p>
          <p className="text-xs text-slate-500">
            Showing latest {startups.length}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-slate-400">
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Program</th>
                <th className="px-6 py-3">Seats</th>
                <th className="px-6 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {startups.map((startup) => (
                <tr
                  key={startup.id}
                  className="border-t border-slate-100 hover:bg-slate-50/60"
                >
                  <td className="px-6 py-3">
                    <Link
                      href={`/dashboard/startups/${startup.id}`}
                      className="flex flex-col text-slate-900 hover:text-sky-600"
                    >
                      <span className="font-semibold">
                        {startup.company_name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {startup.email}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {startup.status}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {startup.program_tier ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {startup.seats_needed ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-slate-600">
                    {new Date(startup.created_at).toLocaleDateString()}
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
