import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { hashPassword, verifyPassword, validateEmail, validatePassword } from "./utils";
import { Id } from "../../../convex/_generated/dataModel";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const convex = new ConvexHttpClient(convexUrl);

const authConfig: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        action: { label: "Action", type: "text" }, // 'signin' or 'signup'
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const email = credentials.email as string;
        const password = credentials.password as string;
        const action = credentials.action as string;

        // Validate email format
        if (!validateEmail(email)) {
          throw new Error("Invalid email format");
        }

        if (action === "signup") {
          // Sign up flow
          const name = credentials.name as string;

          // Validate password
          const passwordValidation = validatePassword(password);
          if (!passwordValidation.valid) {
            throw new Error(passwordValidation.errors[0]);
          }

          // Check if user already exists
          const existingUser = await convex.query(api.auth.getUserByEmail, {
            email,
          });

          if (existingUser) {
            throw new Error("User with this email already exists");
          }

          // Hash password
          const hashedPassword = await hashPassword(password);

          // Create user
          const userId = await convex.mutation(api.auth.createUser, {
            email,
            password: hashedPassword,
            name: name || undefined,
          });

          return {
            id: userId,
            email,
            name: name || null,
            role: "user",
          };
        } else {
          // Sign in flow
          const user = await convex.query(api.auth.getUserByEmail, { email });

          if (!user) {
            throw new Error("Invalid email or password");
          }

          // Check if user has a password (might be OAuth only)
          if (!user.password) {
            throw new Error("Please sign in with your OAuth provider");
          }

          // Verify password
          const isValidPassword = await verifyPassword(password, user.password);

          if (!isValidPassword) {
            throw new Error("Invalid email or password");
          }

          return {
            id: user._id,
            email: user.email,
            name: user.name || null,
            image: user.image || null,
            role: user.role,
          };
        }
      },
    }),
  ],

  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signin",
    error: "/auth/error",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, check if user exists or create new one
      if (account?.provider === "google" || account?.provider === "github") {
        const email = user.email;
        if (!email) {
          return false;
        }

        let existingUser = await convex.query(api.auth.getUserByEmail, {
          email,
        });

        if (!existingUser) {
          // Create new user from OAuth
          const userId = await convex.mutation(api.auth.createUser, {
            email,
            name: user.name || undefined,
            image: user.image || undefined,
            emailVerified: Date.now(),
          });
          user.id = userId;
        } else {
          user.id = existingUser._id;
          // Update user info if changed
          if (existingUser.name !== user.name || existingUser.image !== user.image) {
            await convex.mutation(api.auth.updateUser, {
              id: existingUser._id as Id<"users">,
              name: user.name || undefined,
              image: user.image || undefined,
            });
          }
        }

        // Link account if not already linked
        const existingAccount = await convex.query(
          api.auth.getAccountByProvider,
          {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          }
        );

        if (!existingAccount) {
          await convex.mutation(api.auth.linkAccount, {
            userId: user.id as Id<"users">,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state as string | undefined,
          });
        }
      }

      return true;
    },

    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || "user";
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }

      // Handle session update
      if (trigger === "update" && session) {
        token.name = session.name;
        token.picture = session.image;
      }

      // Fetch latest user data to get updated role
      if (token.id) {
        try {
          const currentUser = await convex.query(api.auth.getUserById, {
            id: token.id as Id<"users">,
          });
          if (currentUser) {
            token.role = currentUser.role;
            token.name = currentUser.name;
            token.picture = currentUser.image;
          }
        } catch (error) {
          console.error("Error fetching user in JWT callback:", error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      console.log("User signed in:", { userId: user.id, isNewUser });
    },
    async signOut({ token }) {
      console.log("User signed out:", token.id);
    },
  },

  debug: process.env.NODE_ENV === "development",
};

// Export NextAuth instance and handlers
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

