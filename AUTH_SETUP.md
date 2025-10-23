# Authentication Setup Guide

This project uses [Convex Auth](https://labs.convex.dev/auth) to provide email/password and OAuth sign-in (Google, GitHub).
Follow the steps below to configure the environment variables and run the app locally.

## 1. Required dependencies

The following packages are required and already included in `package.json`:

- `@convex-dev/auth` – Convex authentication runtime
- `@auth/core` – OAuth provider definitions (Google, GitHub)

Ensure dependencies are installed:

```bash
npm install
```

## 2. Environment variables

Convex functions run in their own environment. You must configure both the **Next.js** and **Convex** environments.

### Next.js (`.env.local`)

```ini
NEXT_PUBLIC_CONVEX_URL="https://<your-convex-deployment>.convex.cloud"
```

### Convex (`convex/.env.local`)

Create `convex/.env.local` and add:

```ini
SITE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
# Optional: comma-separated list of admin email addresses
ADMIN_EMAILS=admin@example.com,founder@example.com
```

> ℹ️ Run `npx convex env list` to confirm values are loaded. In production use `npx convex env set <key> <value>`.

### OAuth credentials

1. **Google** – Create OAuth credentials in the Google Cloud Console. Authorised redirect URI:
   `https://<your-convex-deployment>.convex.cloud/api/auth/callback/google`
2. **GitHub** – Create OAuth App credentials. Authorised callback URL:
   `https://<your-convex-deployment>.convex.cloud/api/auth/callback/github`

During local development Convex automatically exposes a URL when you run `npx convex dev`. Use the development URL in your OAuth settings while testing locally.

## 3. Run the stack

```bash
# Terminal 1 – Convex (generates types)
npx convex dev

# Terminal 2 – Next.js
npm run dev
```

Visit `http://localhost:3000/login` to sign up or sign in. The first account whose email is listed in `ADMIN_EMAILS` is granted the `admin` role automatically.

## 4. Notes

- Password flow supports sign-up and sign-in via `Password` provider.
- OAuth sign-in automatically creates/links accounts and stores user profile data.
- Admin routes (`/admin/*`) and dashboard routes are protected via middleware and client checks.
- Use the `/login` page to access the platform; unauthenticated visitors are redirected there.
