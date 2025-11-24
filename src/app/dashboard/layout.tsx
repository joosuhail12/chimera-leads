import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { syncAdminUser } from "@/lib/services/admin-users";

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
  await syncAdminUser(user);

  return <DashboardShell>{children}</DashboardShell>;
}
