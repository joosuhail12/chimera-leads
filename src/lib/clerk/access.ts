import type { ClerkClient } from "@clerk/backend";
import { clerkClient } from "@clerk/nextjs/server";

export function getAllowedClerkOrganizationId() {
  const orgId = process.env.CLERK_ALLOWED_ORG_ID;

  if (!orgId) {
    throw new Error("CLERK_ALLOWED_ORG_ID is not configured.");
  }

  return orgId;
}

export async function userBelongsToAllowedOrganization(
  userId: string,
  existingClient?: ClerkClient
) {
  if (!userId) {
    return false;
  }

  const orgId = getAllowedClerkOrganizationId();
  const client = existingClient ?? (await clerkClient());
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  });

  return memberships.data.some(
    (membership) => membership.organization.id === orgId
  );
}
