import { AuthConfig } from "convex/server";

// Configure Convex to trust Clerk-issued JWTs from the "convex" template
export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in your Convex dashboard (e.g. https://xxx.clerk.accounts.dev)
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex", // must match the Clerk JWT template name
    },
  ],
} satisfies AuthConfig;
