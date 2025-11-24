import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { syncAdminUser } from "@/lib/services/admin-users";
import { getAllowedClerkOrganizationId } from "@/lib/clerk/access";

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
  if (!orgId || orgId !== allowedOrgId) {
    redirect("/unauthorized?reason=organization");
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  await syncAdminUser(user, {
    client,
    skipOrganizationValidation: true,
  });

  return <DashboardShell>{children}</DashboardShell>;
}
