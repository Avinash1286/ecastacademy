import { ConvexHttpClient } from "convex/browser";
// import { Agent } from "undici";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const deployKey = process.env.CONVEX_DEPLOY_KEY;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
}

const resolvedConvexUrl = convexUrl;



// Agent code removed to fix RSC fetch error

interface CreateConvexClientOptions {
  useAdminAuth?: boolean;
  /** Optional user JWT (e.g., Clerk session token) for user-scoped Convex calls */
  userToken?: string | null;
}

export function createConvexClient(options?: CreateConvexClientOptions): ConvexHttpClient {
  const client = new ConvexHttpClient(resolvedConvexUrl);

  // Prefer user auth when provided, fallback to admin deploy key if allowed.
  if (options?.userToken) {
    client.setAuth(options.userToken);
  } else if (options?.useAdminAuth !== false && deployKey) {
    // Cast to any to access setAdminAuth if it exists on the instance but not the type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).setAdminAuth?.(deployKey);
  } else if (options?.useAdminAuth === false) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).clearAuth?.();
  }

  return client;
}
