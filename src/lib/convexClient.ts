import { ConvexHttpClient } from "convex/browser";
// import { Agent } from "undici";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const deployKey = process.env.CONVEX_DEPLOY_KEY;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");
}

const resolvedConvexUrl = convexUrl;

type ConvexHttpClientInternal = ConvexHttpClient & {
  setFetchOptions?: (options: Record<string, unknown>) => void;
  setAdminAuth?: (token: string) => void;
  clearAuth?: () => void;
};

// Agent code removed to fix RSC fetch error

interface CreateConvexClientOptions {
  useAdminAuth?: boolean;
}

export function createConvexClient(options?: CreateConvexClientOptions): ConvexHttpClient {
  const client = new ConvexHttpClient(resolvedConvexUrl);

  // client.setFetchOptions?.({
  //   dispatcher: getAgent(),
  // });

  if (options?.useAdminAuth !== false && deployKey) {
    // Cast to any to access setAdminAuth if it exists on the instance but not the type
    (client as any).setAdminAuth?.(deployKey);
  } else if (options?.useAdminAuth === false) {
    (client as any).clearAuth?.();
  }

  return client;
}
