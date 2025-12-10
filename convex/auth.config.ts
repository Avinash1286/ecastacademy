import { AuthConfig } from "convex/server";

// Validate CLERK_JWT_ISSUER_DOMAIN environment variable
const CLERK_JWT_ISSUER_DOMAIN = process.env.CLERK_JWT_ISSUER_DOMAIN;
if (!CLERK_JWT_ISSUER_DOMAIN) {
  throw new Error(
    'CLERK_JWT_ISSUER_DOMAIN environment variable is required. ' +
    'Set it in your Convex dashboard: npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://xxx.clerk.accounts.dev"'
  );
}

// Configure Convex to trust Clerk-issued JWTs from the "convex" template
export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in your Convex dashboard (e.g. https://xxx.clerk.accounts.dev)
      domain: CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex", // must match the Clerk JWT template name
    },
  ],
} satisfies AuthConfig;
