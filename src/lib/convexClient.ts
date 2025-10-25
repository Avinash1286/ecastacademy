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
