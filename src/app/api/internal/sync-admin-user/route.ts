import { clerkClient, type WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { userBelongsToAllowedOrganization } from "@/lib/clerk/access";
import { syncAdminUser } from "@/lib/services/admin-users";

type ClerkUserPayload = WebhookEvent["data"] & {
  email_addresses?: { email_address: string }[];
};

const clerkWebhookSecret = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!clerkWebhookSecret) {
    return NextResponse.json(
      { error: "Missing Clerk webhook secret configuration." },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing Svix signature headers." },
      { status: 400 }
    );
  }

  let event: WebhookEvent;
  try {
    const wh = new Webhook(clerkWebhookSecret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch (error) {
    console.error("Clerk webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (!event?.data?.id) {
    return NextResponse.json(
      { error: "Webhook payload missing user id." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const clerkUserId = event.data.id;
  const isDeleted = event.type === "user.deleted";
  const eventData = event.data as ClerkUserPayload;

  if (isDeleted) {
    const deactivated = await deactivateUserRecords(supabase, clerkUserId);
    if (!deactivated) {
      return NextResponse.json(
        { error: "Failed to deactivate user." },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(clerkUserId);
  const isAllowed = await userBelongsToAllowedOrganization(
    clerkUserId,
    client
  );

  if (!isAllowed) {
    const deactivated = await deactivateUserRecords(supabase, clerkUserId);
    if (!deactivated) {
      return NextResponse.json(
        { error: "Failed to deactivate unauthorized user." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        skipped: "User does not belong to the allowed organization.",
      },
      { status: 200 }
    );
  }

  try {
    await syncAdminUser(clerkUser, {
      client,
      skipOrganizationValidation: true,
      fallbackEmail: eventData.email_addresses?.[0]?.email_address,
    });
  } catch (error) {
    console.error("Failed to sync admin user from webhook", error);
    return NextResponse.json(
      { error: "Failed to sync admin user." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

async function deactivateUserRecords(
  supabase: SupabaseClient,
  clerkUserId: string
) {
  const timestamp = new Date().toISOString();

  const [adminResult, profileResult] = await Promise.all([
    supabase
      .from("admin_users")
      .update({
        is_active: false,
        updated_at: timestamp,
      })
      .eq("clerk_user_id", clerkUserId),
    supabase
      .from("user_profiles")
      .update({
        is_active: false,
        updated_at: timestamp,
      })
      .eq("clerk_user_id", clerkUserId),
  ]);

  if (adminResult.error || profileResult.error) {
    console.error(
      "Failed to deactivate user records",
      adminResult.error,
      profileResult.error
    );
    return false;
  }

  return true;
}
