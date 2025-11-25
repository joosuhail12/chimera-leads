import { NextRequest, NextResponse } from "next/server";
import MessageValidator from "sns-validator";
import { recordSesNotification } from "@/lib/services/emails";

const validator = new MessageValidator();

type SnsMessage = {
  Type?: string;
  SubscribeURL?: string;
  Message?: string;
  MessageId?: string;
};

async function validateMessage(message: unknown): Promise<SnsMessage> {
  return new Promise((resolve, reject) => {
    validator.validate(message as Record<string, unknown>, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(data as SnsMessage);
    });
  });
}

async function confirmSubscription(subscribeUrl?: string) {
  if (!subscribeUrl) return;
  await fetch(subscribeUrl);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!rawBody) {
    return NextResponse.json({ error: "Missing SNS body" }, { status: 400 });
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid SNS payload" }, { status: 400 });
  }

  let snsMessage: SnsMessage;
  try {
    snsMessage = await validateMessage(parsedBody);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SNS signature validation failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const messageType = snsMessage.Type;

  if (messageType === "SubscriptionConfirmation") {
    await confirmSubscription(snsMessage.SubscribeURL);
    return NextResponse.json({ status: "subscription_confirmed" });
  }

  if (messageType === "UnsubscribeConfirmation") {
    await confirmSubscription(snsMessage.SubscribeURL);
    return NextResponse.json({ status: "unsubscription_confirmed" });
  }

  if (messageType === "Notification") {
    if (!snsMessage.Message) {
      return NextResponse.json(
        { error: "SNS notification missing Message" },
        { status: 400 }
      );
    }

    let notificationPayload: unknown = snsMessage.Message;
    if (typeof snsMessage.Message === "string") {
      try {
        notificationPayload = JSON.parse(snsMessage.Message);
      } catch {
        // Leave as raw string; still log it for troubleshooting
        notificationPayload = { rawMessage: snsMessage.Message };
      }
    }

    try {
      await recordSesNotification(notificationPayload);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to record SES event";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ status: "notification_recorded" });
  }

  return NextResponse.json({ status: "ignored", type: messageType });
}
