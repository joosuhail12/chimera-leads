"use server";

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { auth } from "@clerk/nextjs/server";

const snsRegion = process.env.AWS_REGION;
const snsTopicArn = process.env.AWS_SNS_TOPIC_ARN;
const snsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const snsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const snsClient =
  snsRegion && snsAccessKeyId && snsSecretAccessKey
    ? new SNSClient({
        region: snsRegion,
        credentials: {
          accessKeyId: snsAccessKeyId,
          secretAccessKey: snsSecretAccessKey,
        },
      })
    : null;

type SendSnsResult =
  | { success: true }
  | { success: false; error: string };

export async function sendSnsNotification(
  message: string,
  subject = "Chimera notification"
): Promise<SendSnsResult> {
  if (!snsClient || !snsTopicArn) {
    return {
      success: false,
      error:
        "AWS SNS is not configured. Set AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_SNS_TOPIC_ARN.",
    };
  }

  const { userId } = await auth();

  if (!userId) {
    return {
      success: false,
      error: "You must be signed in to send notifications.",
    };
  }

  try {
    await snsClient.send(
      new PublishCommand({
        TopicArn: snsTopicArn,
        Message: JSON.stringify({
          userId,
          message,
          sentAt: new Date().toISOString(),
        }),
        Subject: subject,
        MessageAttributes: {
          ChimeraUserId: {
            DataType: "String",
            StringValue: userId,
          },
        },
      })
    );

    return { success: true };
  } catch (error) {
    console.error("SNS publish failed", error);
    return {
      success: false,
      error: "Failed to send notification via AWS SNS.",
    };
  }
}
