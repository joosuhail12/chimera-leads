#!/usr/bin/env node
/* eslint-disable no-console */

const path = require("path");
const { randomUUID, createHash } = require("crypto");
const { config } = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function deterministicId(seed) {
  const hash = createHash("sha1").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(
    12,
    16
  )}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

async function deleteByField(table, field, values) {
  const uniqueValues = Array.from(
    new Set(values.filter((value) => value && value.length))
  );
  if (!uniqueValues.length) {
    return;
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .in(field, uniqueValues);

  if (error) {
    throw new Error(`Failed to delete from ${table}: ${error.message}`);
  }
}

const leadTemplates = [
  {
    name: "Lena Ortiz",
    email: "lena@northwind.ai",
    company: "Northwind AI",
    status: "new",
    priority: "high",
    phone: "+1 415-555-0199",
    message:
      "Evaluating modern outbound tooling. Need visibility into SDR handoffs.",
    current_solution: "Mixpanel dashboards + spreadsheets",
    timeline: "Looking to pilot in 30 days",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/lena-ortiz",
      source: "Conference: SaaStr 2025",
    },
  },
  {
    name: "Drew Patel",
    email: "drew@acmecloud.io",
    company: "Acme Cloud",
    status: "contacted",
    priority: "medium",
    phone: "+1 646-555-0145",
    message: "Sales team doubled last quarter. Need reliable pipeline reports.",
    current_solution: "Looker dashboards",
    timeline: "Budget approved for Q2",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/drewpatel",
      source: "Website demo form",
    },
  },
  {
    name: "Sofia Martins",
    email: "sofia@stellarops.com",
    company: "Stellar Ops",
    status: "qualified",
    priority: "high",
    phone: "+44 20 7946 0958",
    message:
      "Need to unify BC teams in one workspace. Want kanban + booking context.",
    current_solution: "Airtable + Calendly",
    timeline: "Kickoff next sprint",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/sofia-martins",
      current_tools: ["Airtable", "Calendly", "HubSpot"],
    },
  },
  {
    name: "Marcus Shaw",
    email: "marcus@heliumhealth.com",
    company: "Helium Health",
    status: "demo_scheduled",
    priority: "low",
    phone: "+1 312-555-0173",
    message: "Curious about ingestion observability, especially DLQ handling.",
    current_solution: "Internal tooling",
    timeline: "Exploratory",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/marcus-shaw",
      note: "Referred by Pullse partner",
    },
  },
  {
    name: "Noah Kramer",
    email: "noah@vectorlabs.io",
    company: "Vector Labs",
    status: "negotiation",
    priority: "medium",
    phone: "+1 503-555-0117",
    message:
      "Working through security review; need clarity on data retention and DLQs.",
    current_solution: "Zendesk + custom scripts",
    timeline: "Contract review week of 17th",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/noah-kramer",
      security: "SOC2 in progress",
    },
  },
  {
    name: "Priya Desai",
    email: "priya@luminahealth.com",
    company: "Lumina Health",
    status: "closed_won",
    priority: "high",
    phone: "+1 310-555-0190",
    message: "Signed! Need onboarding plan and admin seats provisioned.",
    current_solution: "None",
    timeline: "Immediate onboarding",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/priya-desai",
      note: "Closed via partner referral",
    },
  },
  {
    name: "Ethan Meyer",
    email: "ethan@orbitfin.com",
    company: "Orbit Finance",
    status: "closed_lost",
    priority: "medium",
    phone: "+1 617-555-0177",
    message:
      "Went with internal build for now, but please keep us posted on enterprise features.",
    current_solution: "Internal build",
    timeline: "Revisit next fiscal year",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/ethan-meyer",
      reason: "Budget freeze",
    },
  },
  {
    name: "Mei Tan",
    email: "mei@pixelwave.dev",
    company: "Pixelwave",
    status: "spam",
    priority: "low",
    phone: null,
    message: "Promoting scraped contact lists.",
    current_solution: "Unknown",
    timeline: "N/A",
    raw_payload: {
      source: "Spam submission",
    },
  },
  {
    name: "Victor Han",
    email: "victor@launchforce.studio",
    company: "Launchforce Studio",
    status: "new",
    priority: "critical",
    phone: "+1 206-555-0150",
    message:
      "Need real-time routing between SDRs and partner managers within 2 weeks.",
    current_solution: "HubSpot pipelines",
    timeline: "Urgent",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/victorhan",
    },
  },
  {
    name: "Riley Chen",
    email: "riley@deltaquote.com",
    company: "Delta Quote",
    status: "contacted",
    priority: "medium",
    phone: "+1 917-555-0122",
    message:
      "Interested in better collaboration between RevOps and Product Marketing.",
    current_solution: "Google Sheets",
    timeline: "This quarter",
    raw_payload: {
      linkedin: "https://www.linkedin.com/in/riley-chen",
    },
  },
];

const audienceRecords = [
  {
    email: "sam@queryloop.io",
    first_name: "Sam",
    last_name: "Burke",
    source: "blog",
    tags: ["product", "newsletter"],
    customer_fit_score: 78,
    utm_source: "blog",
    utm_medium: "organic",
    utm_campaign: "pipeline-guide",
  },
  {
    email: "keira@scoutops.com",
    first_name: "Keira",
    last_name: "Lowe",
    source: "webinar",
    tags: ["ops"],
    customer_fit_score: 90,
    utm_source: "webinar",
    utm_medium: "email",
    utm_campaign: "revops-roundtable",
  },
  {
    email: "john@aurorafin.tech",
    first_name: "John",
    last_name: "Okoye",
    source: "referral",
    tags: ["investor", "newsletter"],
    customer_fit_score: 65,
  },
  {
    email: "viola@foundryanalytics.com",
    first_name: "Viola",
    last_name: "Chan",
    source: "partner",
    tags: ["customer"],
    customer_fit_score: 92,
  },
  {
    email: "damon@fluxreach.com",
    first_name: "Damon",
    last_name: "Li",
    source: "podcast",
    tags: ["ops", "newsletter"],
    customer_fit_score: 70,
  },
  {
    email: "ariella@skyline.dev",
    first_name: "Ariella",
    last_name: "Ng",
    source: "product_hunt",
    tags: ["self-serve"],
    customer_fit_score: 60,
  },
];

const startupApplications = [
  {
    company_name: "Atlas Freight",
    website: "https://atlasfreight.io",
    email: "founders@atlasfreight.io",
    status: "under_review",
    program_tier: "plus",
    use_case: "Revenue ops automation",
    total_funding: "$18M Series A",
    seats_needed: "25",
    raw_payload: { source: "YC Winter Referral" },
  },
  {
    company_name: "Neon Parcel",
    website: "https://neonparcel.com",
    email: "ceo@neonparcel.com",
    status: "pending",
    program_tier: "standard",
    use_case: "Lead routing for logistics",
    total_funding: "$4M Seed",
    seats_needed: "10",
  },
  {
    company_name: "Cipherwind",
    website: "https://cipherwind.ai",
    email: "ops@cipherwind.ai",
    status: "interview",
    program_tier: "partner",
    use_case: "Unified GTM visibility",
    total_funding: "$32M Series B",
    seats_needed: "40",
    raw_payload: { requested_features: ["Audit log", "Custom roles"] },
  },
  {
    company_name: "Lumen Bioanalytics",
    website: "https://lumen.bio",
    email: "hello@lumen.bio",
    status: "accepted",
    program_tier: "partner",
    use_case: "Scientific GTM tracking",
    total_funding: "$55M Series B",
    seats_needed: "35",
  },
];

const bookingTemplates = [
  {
    lead_email: "sofia@stellarops.com",
    event_title: "Ops stack discovery call",
    startOffsetDays: 1,
    meeting_url: "https://meet.google.com/example-ops",
    status: "scheduled",
    timezone: "America/New_York",
  },
  {
    lead_email: "marcus@heliumhealth.com",
    event_title: "Chimera demo",
    startOffsetDays: 2,
    meeting_url: "https://meet.google.com/example-demo",
    status: "scheduled",
    timezone: "America/Chicago",
  },
  {
    lead_email: "noah@vectorlabs.io",
    event_title: "Security review deep dive",
    startOffsetDays: 3,
    meeting_url: "https://zoom.us/vectorlabs-security",
    status: "scheduled",
    timezone: "America/Los_Angeles",
  },
  {
    lead_email: "priya@luminahealth.com",
    event_title: "Onboarding workshop",
    startOffsetDays: -1,
    meeting_url: "https://meet.google.com/lumina-onboarding",
    status: "completed",
    timezone: "America/Los_Angeles",
  },
  {
    lead_email: "ethan@orbitfin.com",
    event_title: "Churn save conversation",
    startOffsetDays: -5,
    meeting_url: "https://meet.google.com/orbitfin",
    status: "cancelled",
    timezone: "America/New_York",
  },
];

async function seedLeads() {
  await deleteByField(
    "bookings",
    "lead_email",
    leadTemplates.map((lead) => lead.email)
  );

  const leads = leadTemplates.map((lead, index) => ({
    id: deterministicId(lead.email),
    ...lead,
    created_at: new Date(Date.now() - index * 43200000).toISOString(),
    updated_at: new Date(Date.now() - index * 21600000).toISOString(),
  }));

  await deleteByField("sales_leads", "email", leadTemplates.map((l) => l.email));

  const { error } = await supabase.from("sales_leads").insert(leads);
  if (error) {
    throw new Error(`Failed to insert leads: ${error.message}`);
  }

  console.log(`Inserted ${leads.length} leads.`);
  return leads;
}

async function seedBookings(leads) {
  const leadsByEmail = Object.fromEntries(
    leads.map((lead) => [lead.email, lead])
  );

  const bookings = bookingTemplates
    .map((template) => {
      const lead = leadsByEmail[template.lead_email];
      if (!lead) {
        return null;
      }
      return {
        id: deterministicId(`${lead.id}-${template.event_title}`),
        lead_id: lead.id,
        lead_email: lead.email,
        event_title: template.event_title,
        start_time: new Date(
          Date.now() + template.startOffsetDays * 86400000
        ).toISOString(),
        meeting_url: template.meeting_url,
        status: template.status,
        timezone: template.timezone ?? null,
      };
    })
    .filter(Boolean);

  await deleteByField(
    "bookings",
    "lead_email",
    bookings.map((booking) => booking.lead_email)
  );

  const { error } = await supabase.from("bookings").insert(bookings);
  if (error) {
    throw new Error(`Failed to insert bookings: ${error.message}`);
  }

  console.log(`Inserted ${bookings.length} bookings.`);
}

async function seedAudience() {
  await deleteByField(
    "audience",
    "email",
    audienceRecords.map((record) => record.email)
  );

  const rows = audienceRecords.map((record) => ({
    id: deterministicId(record.email),
    ...record,
  }));

  const { error } = await supabase.from("audience").insert(rows);
  if (error) {
    throw new Error(`Failed to insert audience members: ${error.message}`);
  }

  console.log(`Inserted ${rows.length} audience members.`);
}

async function seedStartupApplications() {
  await deleteByField(
    "startup_applications",
    "email",
    startupApplications.map((record) => record.email)
  );

  const rows = startupApplications.map((record) => ({
    id: deterministicId(record.email),
    ...record,
  }));

  const { error } = await supabase
    .from("startup_applications")
    .insert(rows);

  if (error) {
    throw new Error(
      `Failed to insert startup applications: ${error.message}`
    );
  }

  console.log(`Inserted ${rows.length} startup applications.`);
}

async function seed() {
  console.log("Seeding sample data...");
  try {
    const leads = await seedLeads();
    await seedBookings(leads);
    await seedAudience();
    await seedStartupApplications();
    console.log("Seed complete.");
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

seed();
