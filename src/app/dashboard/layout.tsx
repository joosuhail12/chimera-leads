import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { syncAdminUser } from "@/lib/services/admin-users";
import { userBelongsToAllowedOrganization } from "@/lib/clerk/access";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const isAllowed = await userBelongsToAllowedOrganization(userId, client);

  if (!isAllowed) {
    redirect("/unauthorized?reason=organization");
  }

  await syncAdminUser(user, {
    client,
    skipOrganizationValidation: true,
  });

  return <DashboardShell>{children}</DashboardShell>;
}
