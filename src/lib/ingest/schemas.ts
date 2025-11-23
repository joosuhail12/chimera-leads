import { z } from "zod";

export const salesWebhookSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().min(1),
  company_size: z.string().optional(),
  industry: z.string().optional(),
  timeline: z.string().optional(),
  phone: z.string().optional(),
  current_solution: z.string().optional(),
  message: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_term: z.string().optional(),
  utm_content: z.string().optional(),
  referrer: z.string().optional(),
  landing_page: z.string().optional(),
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
