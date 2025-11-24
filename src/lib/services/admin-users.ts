import { createAdminClient } from "@/lib/supabase/admin";
import {
  getAllowedClerkOrganizationId,
  userBelongsToAllowedOrganization,
} from "@/lib/clerk/access";
import type { ClerkClient } from "@clerk/backend";
import type { User } from "@clerk/nextjs/server";

function getPrimaryEmail(user: User, fallbackEmail?: string | null): string | null {
  const emailFromPrimaryId = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId
  )?.emailAddress;

  return (
    emailFromPrimaryId ||
    user.emailAddresses[0]?.emailAddress ||
    fallbackEmail ||
    null
  );
}

function getPrimaryPhoneNumber(user: User): string | null {
  const phoneFromPrimaryId = user.phoneNumbers.find(
    (phone) => phone.id === user.primaryPhoneNumberId
  )?.phoneNumber;

  return phoneFromPrimaryId || user.phoneNumbers[0]?.phoneNumber || null;
}

type SyncAdminUserOptions = {
  client?: ClerkClient;
  skipOrganizationValidation?: boolean;
  fallbackEmail?: string | null;
};

export async function syncAdminUser(
  user: User,
  options?: SyncAdminUserOptions
) {
  const email = getPrimaryEmail(user, options?.fallbackEmail);
  if (!email) {
    throw new Error("Clerk user is missing an email address.");
  }

  if (!options?.skipOrganizationValidation) {
    const isAllowed = await userBelongsToAllowedOrganization(
      user.id,
      options?.client
    );

    if (!isAllowed) {
      return false;
    }
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const organizationId = getAllowedClerkOrganizationId();
  const displayName =
    user.fullName?.trim() ||
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    email;

  const metadata = {
    publicMetadata: user.publicMetadata,
    privateMetadata: user.privateMetadata,
    unsafeMetadata: user.unsafeMetadata,
  };

  const role =
    (user.publicMetadata?.role as string | undefined) ||
    (user.privateMetadata?.role as string | undefined) ||
    "member";

  const team = user.publicMetadata?.team as string | undefined;

  const { error } = await supabase
    .from("admin_users")
    .upsert(
      {
        clerk_user_id: user.id,
        email: email.toLowerCase(),
        display_name: displayName,
        role,
        team,
        is_active: true,
        last_seen_at: user.lastActiveAt
          ? new Date(user.lastActiveAt).toISOString()
          : nowIso,
        metadata,
        updated_at: nowIso,
      },
      { onConflict: "clerk_user_id" }
    );

  if (error) {
    throw new Error(`Failed to sync admin user record: ${error.message}`);
  }

  const { error: profileError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        clerk_user_id: user.id,
        email: email.toLowerCase(),
        first_name: user.firstName ?? null,
        last_name: user.lastName ?? null,
        full_name: displayName,
        username: user.username ?? null,
        image_url: user.imageUrl ?? null,
        primary_phone: getPrimaryPhoneNumber(user),
        organization_id: organizationId,
        metadata,
        is_active: true,
        updated_at: nowIso,
      },
      { onConflict: "clerk_user_id" }
    );

  if (profileError) {
    throw new Error(`Failed to sync user profile record: ${profileError.message}`);
  }

  return true;
}
