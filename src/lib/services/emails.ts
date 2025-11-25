import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getSesClient } from "@/lib/email/ses-client";
import { createAdminClient } from "@/lib/supabase/admin";

export type EmailTag = {
  name: string;
  value: string;
};

export type EmailCategory = "transactional" | "marketing";

export type SendTransactionalEmailParams = {
  to: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  from?: string;
  replyTo?: string[];
  configurationSetName?: string;
  tags?: EmailTag[];
  metadata?: Record<string, unknown>;
  category?: EmailCategory;
};

export type SendTransactionalEmailResult = {
  messageId: string;
};

const DEFAULT_CHARSET = "UTF-8";

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams
): Promise<SendTransactionalEmailResult> {
  const category: EmailCategory = params.category || "transactional";
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  if (!recipients.length) {
    throw new Error("sendTransactionalEmail requires at least one recipient");
  }

  if (!params.htmlBody && !params.textBody) {
    throw new Error("sendTransactionalEmail requires htmlBody or textBody");
  }

  const fromEmail = params.from || process.env.EMAIL_FROM_ADDRESS;
  if (!fromEmail) {
    throw new Error(
      "Missing from email address. Set EMAIL_FROM_ADDRESS or pass 'from'."
    );
  }

  const configurationSetName =
    params.configurationSetName ||
    selectConfigurationSet(category);

  const supabase = createAdminClient();
  const { data: emailLog, error: logError } = await supabase
    .from("outbound_emails")
    .insert({
      to_email: recipients.join(","),
      from_email: fromEmail,
      subject: params.subject,
      status: "queued",
      tags: params.tags ?? [],
      configuration_set: configurationSetName,
      category,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (logError || !emailLog) {
    throw new Error(
      `Unable to create outbound email log: ${logError?.message ?? "unknown error"}`
    );
  }

  const client = getSesClient();
  const command = new SendEmailCommand({
    FromEmailAddress: fromEmail,
    Destination: {
      ToAddresses: recipients,
    },
    ReplyToAddresses: params.replyTo,
    ConfigurationSetName: configurationSetName,
    EmailTags: params.tags?.map((tag) => ({ Name: tag.name, Value: tag.value })),
    Content: {
      Simple: {
        Subject: { Data: params.subject, Charset: DEFAULT_CHARSET },
        Body: {
          Html: params.htmlBody
            ? { Data: params.htmlBody, Charset: DEFAULT_CHARSET }
            : undefined,
          Text: params.textBody
            ? { Data: params.textBody, Charset: DEFAULT_CHARSET }
            : undefined,
        },
      },
    },
  });

  try {
    const response = await client.send(command);
    const messageId = response.MessageId || "unknown";

    await supabase
      .from("outbound_emails")
      .update({
        status: "sent",
        message_id: messageId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emailLog.id);

    return { messageId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SES send error";
    await supabase
      .from("outbound_emails")
      .update({
        status: "failed",
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", emailLog.id);

    throw error;
  }
}

function selectConfigurationSet(category: EmailCategory | undefined) {
  if (category === "marketing") {
    return (
      process.env.AWS_SES_MARKETING_CONFIGURATION_SET ||
      process.env.AWS_SES_CONFIGURATION_SET
    );
  }

  return process.env.AWS_SES_CONFIGURATION_SET;
}

const EVENT_STATUS_MAP: Record<string, string> = {
  send: "sent",
  delivery: "delivered",
  bounce: "bounced",
  complaint: "complained",
  open: "opened",
  click: "clicked",
  reject: "rejected",
  renderingfailure: "failed",
};

type SesRecipient = { emailAddress?: string };

type SesSnsPayload = {
  eventType?: string;
  notificationType?: string;
  mail?: {
    messageId?: string;
    timestamp?: string;
    destination?: string[];
  };
  send?: { timestamp?: string };
  delivery?: { timestamp?: string; recipients?: string[] };
  bounce?: { timestamp?: string; bounceType?: string; bouncedRecipients?: SesRecipient[] };
  complaint?: {
    timestamp?: string;
    complaintFeedbackType?: string;
    complainedRecipients?: SesRecipient[];
  };
  open?: { timestamp?: string; ipAddress?: string };
  click?: { timestamp?: string; link?: string };
  reject?: { timestamp?: string };
  renderingFailure?: { timestamp?: string };
  [key: string]: unknown;
};

export async function recordSesNotification(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("SES notification payload must be an object");
  }

  const event = payload as SesSnsPayload;
  const eventType =
    (event.eventType || event.notificationType || "unknown").toLowerCase();
  const messageId = event.mail?.messageId ?? null;
  const recipient =
    pickRecipient(event) || event.mail?.destination?.[0] || null;
  const occurredAt =
    resolveTimestamp(event) ||
    event.mail?.timestamp ||
    new Date().toISOString();

  const supabase = createAdminClient();

  await supabase.from("email_events").insert({
    message_id: messageId,
    event_type: eventType,
    recipient,
    occurred_at: new Date(occurredAt).toISOString(),
    payload: event,
  });

  const status = EVENT_STATUS_MAP[eventType];
  if (messageId && status) {
    await supabase
      .from("outbound_emails")
      .update({
        status,
        last_event_at: new Date(occurredAt).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("message_id", messageId);
  }
}

function resolveTimestamp(event: SesSnsPayload) {
  return (
    event.delivery?.timestamp ||
    event.bounce?.timestamp ||
    event.complaint?.timestamp ||
    event.open?.timestamp ||
    event.click?.timestamp ||
    event.reject?.timestamp ||
    event.renderingFailure?.timestamp ||
    event.send?.timestamp ||
    null
  );
}

function pickRecipient(event: SesSnsPayload) {
  const fromBounce = event.bounce?.bouncedRecipients?.[0]?.emailAddress;
  if (fromBounce) return fromBounce;

  const fromComplaint =
    event.complaint?.complainedRecipients?.[0]?.emailAddress;
  if (fromComplaint) return fromComplaint;

  const fromDelivery = event.delivery?.recipients?.[0];
  if (fromDelivery) return fromDelivery;

  return null;
}
