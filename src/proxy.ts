import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import {
  getAllowedClerkOrganizationId,
  userBelongsToAllowedOrganization,
} from "@/lib/clerk/access";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sign-out(.*)",
  "/sso-callback(.*)",
  "/api/webhooks(.*)",
  "/unauthorized",
]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const session = await auth();
    await auth.protect();

    const allowedOrgId = getAllowedClerkOrganizationId();
    let hasAccess = session.orgId === allowedOrgId;

    if (!hasAccess && session.userId) {
      hasAccess = await userBelongsToAllowedOrganization(session.userId);
    }

    if (!hasAccess) {
      if (req.nextUrl.pathname.startsWith("/api")) {
        return NextResponse.json(
          { error: "Access restricted to authorized organization members." },
          { status: 403 }
        );
      }

      const unauthorizedUrl = new URL("/unauthorized", req.url);
      unauthorizedUrl.searchParams.set("reason", "organization");
      unauthorizedUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
