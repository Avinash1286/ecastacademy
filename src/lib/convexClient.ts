import { ConvexHttpClient } from "convex/browser";
import { Agent } from "undici";

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

declare global {
  var __convexAgent: Agent | undefined;
}

/**
 * Get the shared undici Agent singleton configured to use IPv4 for outgoing connections.
 *
 * @returns The global Agent instance used as the HTTP dispatcher.
 */
function getAgent(): Agent {
  if (!globalThis.__convexAgent) {
    globalThis.__convexAgent = new Agent({
      connect: { family: 4 },
    });
  }

  return globalThis.__convexAgent;
}

interface CreateConvexClientOptions {
  useAdminAuth?: boolean;
}

/**
 * Create and configure a ConvexHttpClient for the application's Convex deployment.
 *
 * @param options - Optional settings. If `useAdminAuth` is not false and a deploy key is available, the client will be configured with admin authentication; if `useAdminAuth` is explicitly false, authentication will be cleared.
 * @returns A ConvexHttpClient connected to the resolved Convex URL and configured to use the shared HTTP agent and the requested authentication state.
 */
export function createConvexClient(options?: CreateConvexClientOptions): ConvexHttpClient {
  const client = new ConvexHttpClient(resolvedConvexUrl) as ConvexHttpClientInternal;

  client.setFetchOptions?.({
    dispatcher: getAgent(),
  });

  if (options?.useAdminAuth !== false && deployKey) {
    client.setAdminAuth?.(deployKey);
  } else if (options?.useAdminAuth === false) {
    client.clearAuth?.();
  }

  return client;
}