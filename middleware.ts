import { NextRequest } from "next/server";
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/api/auth(.*)",
  "/_next/static/(.*)",
  "/_next/image",
  "/favicon.ico",
  "/images/(.*)",
  "/fonts/(.*)",
  "/public/(.*)",
]);

export default convexAuthNextjsMiddleware(async (request: NextRequest, { convexAuth }) => {
  if (isPublicRoute(request)) {
    return;
  }

  const isAuthenticated = await convexAuth.isAuthenticated();
  if (isAuthenticated) {
    return;
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  const currentPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (currentPath && currentPath !== "/") {
    loginUrl.searchParams.set("redirectTo", currentPath);
  }

  return nextjsMiddlewareRedirect(request, `${loginUrl.pathname}${loginUrl.search}`);
});

export const config = {
  matcher: ["/(.*)"],
};
