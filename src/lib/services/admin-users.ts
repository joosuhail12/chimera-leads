import { createAdminClient } from "@/lib/supabase/admin";
import { userBelongsToAllowedOrganization } from "@/lib/clerk/access";
import type { ClerkClient } from "@clerk/backend";
import type { User } from "@clerk/nextjs/server";

function getPrimaryEmail(user: User): string | null {
  const emailFromPrimaryId = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId
  )?.emailAddress;

  return (
    emailFromPrimaryId ||
    user.emailAddresses[0]?.emailAddress ||
    null
  );
}

type SyncAdminUserOptions = {
  client?: ClerkClient;
  skipOrganizationValidation?: boolean;
};

export async function syncAdminUser(
  user: User,
  options?: SyncAdminUserOptions
) {
  const email = getPrimaryEmail(user);
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
          : new Date().toISOString(),
        metadata,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "clerk_user_id" }
    );

  if (error) {
    throw new Error(`Failed to sync admin user record: ${error.message}`);
  }

  return true;
}
