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
  .transform((data) => {
    const lead: SalesFlat =
      typeof data === "object" &&
      data !== null &&
      "payload" in data &&
      data.payload &&
      typeof (data as Record<string, unknown>).payload === "object" &&
      (data as Record<string, unknown>).payload !== null &&
      "id" in (data as { payload: Record<string, unknown> }).payload
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

const baseStartupSchema = z
  .object({
    id: z.string().uuid().optional(),
    application_id: z.string().uuid().optional(),
    request_id: z.string().optional(),
    company_name: z.string().min(1),
    website: z.string().min(1),
    email: z.string().email(),
    founding_date: z.string().optional().nullable(),
    annual_revenue: z.string().optional().nullable(),
    total_funding: z.string().optional().nullable(),
    seats_needed: z.string().optional().nullable(),
    customer_status: z.string().optional().nullable(),
    current_tools: z.string().optional().nullable(),
    use_case: z.string().optional().nullable(),
    utm_source: z.string().optional().nullable(),
    utm_medium: z.string().optional().nullable(),
    utm_campaign: z.string().optional().nullable(),
    utm_term: z.string().optional().nullable(),
    utm_content: z.string().optional().nullable(),
    referrer: z.string().optional().nullable(),
    landing_page: z.string().optional().nullable(),
    form_path: z.string().optional().nullable(),
  })
  .superRefine((values, ctx) => {
    if (!values.id && !values.application_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Startup application must include id or application_id",
      });
    }
  });

const envelopeStartupSchema = z.object({
  event: z.string().optional(),
  type: z.literal("startup_application").optional(),
  payload: baseStartupSchema,
});

type StartupEnvelope = z.infer<typeof envelopeStartupSchema>;
type StartupFlat = z.infer<typeof baseStartupSchema>;

export const startupWebhookSchema = z
  .union([envelopeStartupSchema, baseStartupSchema])
  .transform((data) => {
    const lead: StartupFlat =
      typeof data === "object" &&
      data !== null &&
      "payload" in data &&
      (data as { payload?: unknown }).payload &&
      typeof (data as { payload?: unknown }).payload === "object"
        ? (data as StartupEnvelope).payload
        : (data as StartupFlat);

    return {
      id: lead.id ?? lead.application_id!,
      original_id: lead.application_id ?? lead.id ?? undefined,
      request_id: lead.request_id,
      company_name: lead.company_name,
      website: lead.website,
      email: lead.email,
      founding_date: lead.founding_date ?? undefined,
      annual_revenue: lead.annual_revenue ?? undefined,
      total_funding: lead.total_funding ?? undefined,
      seats_needed: lead.seats_needed ?? undefined,
      customer_status: lead.customer_status ?? undefined,
      current_tools: lead.current_tools ?? undefined,
      use_case: lead.use_case ?? undefined,
      utm_source: lead.utm_source ?? undefined,
      utm_medium: lead.utm_medium ?? undefined,
      utm_campaign: lead.utm_campaign ?? undefined,
      utm_term: lead.utm_term ?? undefined,
      utm_content: lead.utm_content ?? undefined,
      referrer: lead.referrer ?? undefined,
      landing_page: lead.landing_page ?? lead.form_path ?? undefined,
    };
  });

const newsletterAttributionSchema = z.object({
  utm_source: z.string().optional().nullable(),
  utm_medium: z.string().optional().nullable(),
  utm_campaign: z.string().optional().nullable(),
  utm_term: z.string().optional().nullable(),
  utm_content: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  form_path: z.string().optional().nullable(),
  landing_page: z.string().optional().nullable(),
});

export const newsletterWebhookSchema = z
  .object({
    event: z.string().optional(),
    type: z.literal("newsletter_signup").optional(),
    email: z.string().email(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
    attribution: newsletterAttributionSchema.optional(),
  })
  .transform((data) => ({
    email: data.email,
    first_name: data.first_name ?? undefined,
    last_name: data.last_name ?? undefined,
    source: data.source ?? undefined,
    attribution: data.attribution,
  }));

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
