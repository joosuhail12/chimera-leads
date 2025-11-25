import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { syncAdminUser } from "@/lib/services/admin-users";
import {
  getAllowedClerkOrganizationId,
  userBelongsToAllowedOrganization,
} from "@/lib/clerk/access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const allowedOrgId = getAllowedClerkOrganizationId();
  let client: Awaited<ReturnType<typeof clerkClient>> | null = null;
  let isAllowed = orgId === allowedOrgId;

  if (!isAllowed) {
    client = await clerkClient();
    isAllowed = await userBelongsToAllowedOrganization(userId, client);
  }

  if (!isAllowed) {
    redirect("/unauthorized?reason=organization");
  }

  const resolvedClient = client ?? (await clerkClient());
  const user = await resolvedClient.users.getUser(userId);

  await syncAdminUser(user, {
    client: resolvedClient,
    skipOrganizationValidation: true,
  });

  return <DashboardShell>{children}</DashboardShell>;
}
