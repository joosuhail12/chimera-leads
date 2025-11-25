"use server";

import Knock, { APIError } from "@knocklabs/node";
import { auth } from "@clerk/nextjs/server";

const knockApiKey = process.env.KNOCK_API_KEY;
const knockWorkflow = process.env.KNOCK_TEST_WORKFLOW_ID || "knock-quickstart";

const knockClient = knockApiKey ? new Knock({ apiKey: knockApiKey }) : null;

type TriggerKnockResult =
  | { success: true }
  | { success: false; error: string };

export async function triggerKnockWorkflow(
  message: string
): Promise<TriggerKnockResult> {
  if (!knockClient) {
    return { success: false, error: "Knock API key is not configured." };
  }

  const { userId } = await auth();

  if (!userId) {
    return { success: false, error: "You must be signed in to trigger notifications." };
  }

  try {
    await knockClient.workflows.trigger(knockWorkflow, {
      recipients: [userId],
      data: {
        message,
      },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof APIError && error.status === 404) {
      console.error("Knock workflow not found", {
        workflow: knockWorkflow,
        status: error.status,
      });
      return {
        success: false,
        error:
          "Knock workflow not found in this environment. Set KNOCK_TEST_WORKFLOW_ID or create the workflow in Knock before triggering.",
      };
    }

    console.error("Knock workflow trigger failed", error);
    return {
      success: false,
      error: "Failed to trigger workflow. Check your Knock configuration.",
    };
  }
}
