import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_STATUSES } from "@/lib/constants/leads";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  const [
    { data: lead, error: leadError },
    { data: bookings, error: bookingError },
    { data: customFieldValues, error: customFieldError },
    { data: activities, error: activityError },
    { data: tasks, error: taskError },
  ] = await Promise.all([
    supabase
      .from("sales_leads")
      .select(
        "id, name, email, phone, company, status, message, current_solution, timeline, created_at, updated_at, assigned_to, admin_notes, raw_payload"
      )
      .eq("id", id)
      .single(),
    supabase
      .from("bookings")
      .select("id, event_title, start_time, meeting_url, status")
      .eq("lead_id", id)
      .order("start_time", { ascending: true }),
    supabase
      .from("custom_field_values")
      .select(
        "value_text,value_number,value_boolean,value_date,value_json,definition:custom_field_definitions(id,name,field_key,field_type)"
      )
      .eq("entity_id", id)
      .eq("entity_type", "sales_leads"),
    supabase
      .from("crm_activities")
      .select("*")
      .eq("lead_id", id)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("crm_tasks")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (leadError || !lead) {
    console.error("Lead lookup failed", leadError);
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }

  if (bookingError) {
    console.error("Booking lookup failed", bookingError);
  }

  if (customFieldError) {
    console.error("Lead custom fields lookup failed", customFieldError);
  }

  const customFields = (customFieldValues ?? [])
    .map((row) => {
      const def = Array.isArray(row.definition) ? row.definition[0] : row.definition;
      return {
        id: def?.id ?? null,
        name: def?.name ?? def?.field_key ?? "Custom field",
        field_key: def?.field_key ?? null,
        field_type: def?.field_type ?? "text",
        value_text: row.value_text,
        value_number: row.value_number,
        value_boolean: row.value_boolean,
        value_date: row.value_date,
        value_json: row.value_json,
      };
    })
    .filter((field) => field.id);

  return NextResponse.json({
    lead,
    bookings: bookings ?? [],
    customFields,
    activities: activities ?? [],
    tasks: tasks ?? [],
    statusMeta:
      LEAD_STATUSES.find((status) => status.value === lead.status) ?? null,
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createAdminClient();
  const payload = (await request.json()) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  const editableFields = [
    "name",
    "email",
    "phone",
    "company",
    "status",
    "message",
    "current_solution",
    "timeline",
    "admin_notes",
  ];

  editableFields.forEach((field) => {
    if (field in payload) {
      updates[field] = payload[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No updates supplied." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("sales_leads")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Lead update failed", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update lead." },
      { status: 400 }
    );
  }

  return NextResponse.json({ lead: data });
}
