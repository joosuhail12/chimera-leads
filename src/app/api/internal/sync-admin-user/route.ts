import { clerkClient, type WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";
import { userBelongsToAllowedOrganization } from "@/lib/clerk/access";

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
    const { error } = await supabase
      .from("admin_users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", clerkUserId);

    if (error) {
      console.error("Failed to deactivate admin user", error);
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
    const { error: deactivationError } = await supabase
      .from("admin_users")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", clerkUserId);

    if (deactivationError) {
      console.error(
        "Failed to deactivate unauthorized admin user",
        deactivationError
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

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ||
    clerkUser.emailAddresses[0]?.emailAddress ||
    eventData.email_addresses?.[0]?.email_address;

  if (!primaryEmail) {
    return NextResponse.json(
      { error: "User email is required." },
      { status: 400 }
    );
  }

  const displayName =
    (clerkUser.fullName || "")
      .trim()
      .replace(/\s+/g, " ") ||
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
    primaryEmail;

  const role =
    (clerkUser.publicMetadata?.role as string | undefined) ||
    (clerkUser.privateMetadata?.role as string | undefined) ||
    "member";
  const team = clerkUser.publicMetadata?.team as string | undefined;

  const metadata = {
    publicMetadata: clerkUser.publicMetadata,
    privateMetadata: clerkUser.privateMetadata,
    unsafeMetadata: clerkUser.unsafeMetadata,
  };

  const { error } = await supabase
    .from("admin_users")
    .upsert(
      {
        clerk_user_id: clerkUser.id,
        email: primaryEmail.toLowerCase(),
        display_name: displayName,
        role,
        team,
        is_active: true,
        last_seen_at:
          typeof clerkUser.lastActiveAt === "number"
            ? new Date(clerkUser.lastActiveAt).toISOString()
            : null,
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );

  if (error) {
    console.error("Failed to upsert admin user", error);
    return NextResponse.json(
      { error: "Failed to sync admin user." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
