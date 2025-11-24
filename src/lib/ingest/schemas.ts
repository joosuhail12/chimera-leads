import { z } from "zod";

const attributionSchema = z.object({
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  utm_term: z.string().optional().nullable(),
  utm_content: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  landing_page: z.string().optional().nullable(),
});

const baseSalesLeadSchema = z.object({
  id: z.string().uuid(),
  submission_id: z.string().optional(),
  request_id: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  company_size: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  timeline: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  message: z.string().optional().nullable(),
  current_solution: z.string().optional().nullable(),
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  utm_term: z.string().optional().nullable(),
  utm_content: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  landing_page: z.string().optional().nullable(),
  form_path: z.string().optional().nullable(),
  payload: z.unknown().optional(),
});

const envelopeSalesSchema = z.object({
  event: z.string().optional(),
  type: z.literal("contact_sales").optional(),
  payload: baseSalesLeadSchema.extend({
    payload: z
      .object({
        currentSolution: z.string().optional(),
        attribution: attributionSchema.optional(),
      })
      .passthrough()
      .optional(),
  }),
});

type SalesEnvelope = z.infer<typeof envelopeSalesSchema>;
type SalesFlat = z.infer<typeof baseSalesLeadSchema>;

export const salesWebhookSchema = z
  .union([envelopeSalesSchema, baseSalesLeadSchema])
  .transform((data): SalesWebhookPayload => {
    const lead: SalesFlat =
      "payload" in data && data.payload && "id" in data.payload
        ? (data as SalesEnvelope).payload
        : (data as SalesFlat);

    const nestedPayload =
      typeof lead.payload === "object" && lead.payload !== null
        ? (lead.payload as Record<string, unknown>)
        : undefined;
    const nestedAttribution = nestedPayload?.attribution as
      | z.infer<typeof attributionSchema>
      | undefined;

    return {
      id: lead.id,
      submission_id: lead.submission_id,
      request_id: lead.request_id,
      name: lead.name,
      email: lead.email,
      company: lead.company,
      company_size: lead.company_size ?? undefined,
      industry: lead.industry ?? undefined,
      timeline: lead.timeline ?? undefined,
      phone: lead.phone ?? undefined,
      message: lead.message ?? undefined,
      current_solution:
        lead.current_solution ??
        (nestedPayload?.currentSolution as string | undefined),
      utm_source: lead.utm_source ?? nestedAttribution?.utm_source ?? (nestedPayload?.utm_source as string | undefined),
      utm_medium: lead.utm_medium ?? nestedAttribution?.utm_medium ?? (nestedPayload?.utm_medium as string | undefined),
      utm_campaign: lead.utm_campaign ?? nestedAttribution?.utm_campaign ?? (nestedPayload?.utm_campaign as string | undefined),
      utm_term: lead.utm_term ?? nestedAttribution?.utm_term ?? (nestedPayload?.utm_term as string | undefined),
      utm_content: lead.utm_content ?? nestedAttribution?.utm_content ?? (nestedPayload?.utm_content as string | undefined),
      referrer: lead.referrer ?? nestedAttribution?.referrer,
      landing_page:
        lead.landing_page ??
        nestedAttribution?.landing_page ??
        (nestedPayload?.landing_page as string | undefined) ??
        (lead.form_path ?? undefined),
      raw_payload: (data as unknown) as Record<string, unknown>,
    };
  });

export const startupWebhookSchema = z.object({
  id: z.string().uuid(),
  company_name: z.string().min(1),
  website: z.string().min(1),
  email: z.string().email(),
  founding_date: z.string().optional(),
  annual_revenue: z.string().optional(),
  total_funding: z.string().optional(),
  seats_needed: z.string().optional(),
  customer_status: z.string().optional(),
  current_tools: z.string().optional(),
  use_case: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
});

export const newsletterWebhookSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  source: z.string().optional(),
  attribution: z
    .object({
      utm_source: z.string().optional(),
      utm_medium: z.string().optional(),
      utm_campaign: z.string().optional(),
    })
    .optional(),
});

export const bookingWebhookSchema = z.object({
  submission_id: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  event_title: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  meeting_url: z.string().optional(),
  notes: z.string().optional(),
  raw: z.unknown().optional(),
});

export type SalesWebhookPayload = z.infer<typeof salesWebhookSchema>;
export type StartupWebhookPayload = z.infer<typeof startupWebhookSchema>;
export type NewsletterWebhookPayload = z.infer<typeof newsletterWebhookSchema>;
export type BookingWebhookPayload = z.infer<typeof bookingWebhookSchema>;

export type WebhookType =
  | "contact_sales"
  | "demo_meeting"
  | "startup_application"
  | "newsletter_signup";

export const WEBHOOK_RESOURCE_MAP: Record<WebhookType, string> = {
  contact_sales: "sales_leads",
  demo_meeting: "bookings",
  startup_application: "startup_applications",
  newsletter_signup: "audience",
};
