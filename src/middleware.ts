import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { updateSession } from "@/lib/supabase/middleware";
import { userBelongsToAllowedOrganization } from "@/lib/clerk/access";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/webhooks(.*)",
  "/unauthorized",
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect();

    const { userId } = await auth();
    if (userId) {
      const isAllowed = await userBelongsToAllowedOrganization(userId);
      if (!isAllowed) {
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
  }

  // Update Supabase session
  return updateSession(req);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
