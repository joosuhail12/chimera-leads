"use server";

import Knock from "@knocklabs/node";
import { auth } from "@clerk/nextjs/server";

const knockApiKey = process.env.KNOCK_API_KEY;
const knockWorkflow = process.env.KNOCK_TEST_WORKFLOW_ID || "knock-quickstart";

const knockClient = knockApiKey ? new Knock({ apiKey: knockApiKey }) : null;

export async function triggerKnockWorkflow(message: string) {
  if (!knockClient) {
    throw new Error("KNOCK_API_KEY is not configured.");
  }

  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be signed in to trigger notifications.");
  }

  const response = await knockClient.workflows.trigger(knockWorkflow, {
    recipients: [userId],
    data: {
      message,
    },
  });

  return response;
}
