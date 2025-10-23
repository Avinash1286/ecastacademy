import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { AuthProviderConfig } from "@convex-dev/auth/server";
import type { Value } from "convex/values";

const adminEmailSet = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function deriveRole(email: string | undefined) {
  if (!email) {
    return "user" as const;
  }
  return adminEmailSet.has(email.toLowerCase()) ? "admin" : "user";
}

type SignInParams = Record<string, Value | undefined>;

const providers: AuthProviderConfig[] = [
  Password({
    profile: (params: SignInParams) => {
      const emailRaw = typeof params.email === "string" ? params.email.trim() : null;
      if (!emailRaw) {
        throw new Error("Email is required");
      }

      const profile: Record<string, Value> & { email: string } = {
        email: emailRaw.toLowerCase(),
      };

      const name = typeof params.name === "string" ? params.name.trim() : "";
      if (name) {
        profile.name = name;
      }

      return profile;
    },
  }),
];

function registerOAuthProvider(
  label: string,
  keys: { clientId: string; clientSecret: string },
  factory: (clientId: string, clientSecret: string) => AuthProviderConfig,
) {
  const clientId = process.env[keys.clientId];
  const clientSecret = process.env[keys.clientSecret];

  if (clientId && clientSecret) {
    providers.push(factory(clientId, clientSecret));
    return;
  }

  const message = `${label} OAuth disabled: configure ${keys.clientId} and ${keys.clientSecret} in Convex environment variables.`;
  console.warn(`[convex-auth] ${message}`);
}

registerOAuthProvider(
  "Google",
  { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
  (clientId, clientSecret) =>
    Google({
      clientId,
      clientSecret,
    }),
);

registerOAuthProvider(
  "GitHub",
  { clientId: "GITHUB_CLIENT_ID", clientSecret: "GITHUB_CLIENT_SECRET" },
  (clientId, clientSecret) =>
    GitHub({
      clientId,
      clientSecret,
    }),
);

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      if (args.type !== "oauth" && args.type !== "credentials") {
        return;
      }

      const now = Date.now();
      const user = await ctx.db.get(args.userId);
      if (!user) {
        return;
      }

      const updates: Record<string, unknown> = { updatedAt: now };
      const profile = args.profile as Record<string, unknown> & {
        email?: string;
        name?: string;
        image?: string;
      };

      const profileEmail = typeof profile.email === "string" ? profile.email : undefined;
      const profileName = typeof profile.name === "string" ? profile.name : undefined;
      const profileImage = typeof profile.image === "string" ? profile.image : undefined;

      if (profileEmail && user.email !== profileEmail) {
        updates.email = profileEmail;
      }

      if (profileName && user.name !== profileName) {
        updates.name = profileName;
      }

      if (profileImage && user.image !== profileImage) {
        updates.image = profileImage;
      }

      if (!user.role) {
        updates.role = deriveRole(profileEmail);
      }

      if (!user.createdAt) {
        updates.createdAt = now;
      }

      await ctx.db.patch(args.userId, updates);
    },
  },
});
