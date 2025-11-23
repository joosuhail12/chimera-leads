import { createAdminClient } from "@/lib/supabase/admin";
import {
  bookingWebhookSchema,
  newsletterWebhookSchema,
  salesWebhookSchema,
  startupWebhookSchema,
  WEBHOOK_RESOURCE_MAP,
  type WebhookType,
} from "@/lib/ingest/schemas";
import { upsertSalesLead } from "@/lib/services/leads";
import { upsertStartupApplication } from "@/lib/services/startup-applications";
import { upsertAudienceMember } from "@/lib/services/audience";
import { upsertBooking } from "@/lib/services/bookings";
import { recordIngestionEvent } from "@/lib/services/ingestion-events";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";

const SIGNATURE_HEADER = "x-webhook-signature";
const TYPE_HEADER = "x-webhook-type";

const TYPE_ALIASES: Record<string, WebhookType> = {
  "contact_sales": "contact_sales",
  "contact-sales": "contact_sales",
  sales: "contact_sales",
  "primary_lead": "contact_sales",
  "demo_meeting": "demo_meeting",
  "demo-booking": "demo_meeting",
  "demo_booking": "demo_meeting",
  booking: "demo_meeting",
  "contact-sales/booking": "demo_meeting",
  "startup_application": "startup_application",
  "startup-program": "startup_application",
  "startup_program": "startup_application",
  startup: "startup_application",
  "newsletter_signup": "newsletter_signup",
  newsletter: "newsletter_signup",
  audience: "newsletter_signup",
};

export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret is not configured." },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get(SIGNATURE_HEADER);

  if (!verifySignature(signature, rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!parsedBody || typeof parsedBody !== "object") {
    return NextResponse.json(
      { error: "Webhook payload must be an object." },
      { status: 400 }
    );
  }

  const payload = parsedBody as Record<string, unknown>;
  const url = new URL(request.url);

  const typeCandidates = [
    request.headers.get(TYPE_HEADER),
    url.searchParams.get("type"),
    typeof payload.type === "string" ? payload.type : undefined,
    typeof payload.event === "string" ? payload.event : undefined,
    typeof payload.form === "string" ? payload.form : undefined,
    typeof payload.webhook === "string" ? payload.webhook : undefined,
    typeof payload.webhook_type === "string" ? payload.webhook_type : undefined,
  ];

  const webhookType = resolveWebhookType(typeCandidates);
  if (!webhookType) {
    return NextResponse.json(
      { error: "Unable to determine webhook type." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const resourceType = WEBHOOK_RESOURCE_MAP[webhookType];

  try {
    let resourceId = "";

    switch (webhookType) {
      case "contact_sales": {
        const validated = salesWebhookSchema.parse(payload);
        resourceId = await upsertSalesLead(supabase, validated);
        break;
      }
      case "demo_meeting": {
        const validated = bookingWebhookSchema.parse(payload);
        resourceId = await upsertBooking(supabase, validated);
        break;
      }
      case "startup_application": {
        const validated = startupWebhookSchema.parse(payload);
        resourceId = await upsertStartupApplication(supabase, validated);
        break;
      }
      case "newsletter_signup": {
        const validated = newsletterWebhookSchema.parse(payload);
        resourceId = await upsertAudienceMember(supabase, validated);
        break;
      }
      default:
        throw new Error(`Unsupported webhook type: ${webhookType}`);
    }

    await recordIngestionEvent(supabase, {
      source: webhookType,
      resourceType,
      resourceId,
      status: "success",
      payload,
    });

    return NextResponse.json({
      status: "ok",
      type: webhookType,
      resourceId,
    });
  } catch (error) {
    const message = formatErrorMessage(error);
    await recordIngestionEvent(supabase, {
      source: webhookType,
      resourceType,
      status: "error",
      payload,
      errorMessage: message,
    });

    const status = error instanceof ZodError ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function resolveWebhookType(
  candidates: Array<string | null | undefined>
): WebhookType | null {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const normalized = candidate.trim().toLowerCase();
    const mapped = TYPE_ALIASES[normalized as keyof typeof TYPE_ALIASES];
    if (mapped) {
      return mapped;
    }
  }
  return null;
}

function verifySignature(
  signature: string | null,
  body: string,
  secret: string
) {
  if (!signature) return false;
  const normalized = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;
  const hmac = createHmac("sha256", secret);
  const expected = hmac.update(body).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(normalized);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function formatErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return (
      "Payload validation failed: " +
      error.errors.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown ingestion error.";
}
