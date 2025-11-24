import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/constants/leads";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales_leads")
    .select("id, name, company, email, status, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load pipeline data", error);
    return NextResponse.json(
      { error: "Failed to load pipeline data." },
      { status: 500 }
    );
  }

  const columns = LEAD_STATUSES.reduce(
    (acc, status) => ({
      ...acc,
      [status.value]: [] as Array<{
        id: string;
        name: string;
        company: string | null;
        email: string;
        status: LeadStatus;
        updated_at: string | null;
      }>,
    }),
    {} as Record<
      LeadStatus,
      Array<{
        id: string;
        name: string;
        company: string | null;
        email: string;
        status: LeadStatus;
        updated_at: string | null;
      }>
    >
  );

  (data ?? []).forEach((lead) => {
    const status = (lead.status as LeadStatus) ?? "new";
    const safeStatus = columns[status] ? status : "new";
    columns[safeStatus].push({
      id: lead.id,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      status: safeStatus,
      updated_at: lead.updated_at,
    });
  });

  return NextResponse.json({ columns });
}
