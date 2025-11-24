import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { getAllowedClerkOrganizationId } from "@/lib/clerk/access";

type UnauthorizedPageProps = {
  searchParams?: {
    redirectTo?: string;
  };
};

export default function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const redirectPath = searchParams?.redirectTo;
  const allowedOrgId = getAllowedClerkOrganizationId();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Access restricted</h1>
        <p className="text-gray-500">
          Only members of the organization <span className="font-mono">{allowedOrgId}</span> can
          access this application. Please contact an administrator if you believe this is an error.
        </p>
        {redirectPath ? (
          <p className="text-sm text-gray-500">
            Original destination: <span className="font-mono">{redirectPath}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <SignOutButton redirectUrl="/sign-in">
          <button className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
            Sign out
          </button>
        </SignOutButton>
        <Link
          href="mailto:support@getpullse.com?subject=Access%20Request"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
        >
          Contact support
        </Link>
      </div>
    </main>
  );
}
