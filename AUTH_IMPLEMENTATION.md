# NextAuth Authentication Implementation - Complete Documentation

## Overview

This document provides a complete overview of the NextAuth.js authentication system implemented for ECAST Academy. The implementation includes email/password authentication, OAuth (Google & GitHub), password reset functionality, and role-based access control.

## Architecture

### Technology Stack

- **NextAuth.js v5 (Beta)**: Main authentication library with App Router support
- **Convex**: Backend database for user data, sessions, and tokens
- **bcryptjs**: Password hashing
- **nodemailer**: Email service for password reset
- **React Icons**: Social login icons

### Authentication Flow

```
┌─────────────┐
│   Landing   │
│    Page     │──────► Sign In / Sign Up
└─────────────┘
       │
       ▼
┌─────────────────────────────────┐
│   Authentication Methods        │
│                                 │
│  1. Email/Password              │
│  2. Google OAuth                │
│  3. GitHub OAuth                │
└─────────────────────────────────┘
       │
       ▼
┌─────────────┐
│  NextAuth   │──────► JWT Token
│  Callback   │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Convex DB  │◄────── Custom Helper Functions (convex/auth.ts)
│   Backend   │
└─────────────┘
       │
       ▼
┌─────────────┐
│  Dashboard  │
│  Protected  │
└─────────────┘
```

### How It Works

1. **Frontend**: User interacts with auth forms (Sign In/Sign Up)
2. **NextAuth.js**: Handles authentication logic, OAuth flows, JWT tokens
3. **Custom Helpers** (`convex/auth.ts`): Provides database operations for NextAuth.js
4. **Convex Database**: Stores users, sessions, accounts, and verification tokens
5. **Session Management**: NextAuth.js manages JWT sessions with Convex as persistence layer

## Database Schema

### Tables Added to Convex

#### 1. `users` Table
```typescript
{
  name: string (optional)
  email: string (unique)
  emailVerified: number (optional)
  image: string (optional)
  password: string (optional, hashed)
  role: "user" | "admin"
  createdAt: number
  updatedAt: number
}
```

**Indexes:**
- `by_email` - Fast user lookup by email

#### 2. `accounts` Table
```typescript
{
  userId: Id<"users">
  type: string
  provider: string (google, github, credentials)
  providerAccountId: string
  refresh_token: string (optional)
  access_token: string (optional)
  expires_at: number (optional)
  token_type: string (optional)
  scope: string (optional)
  id_token: string (optional)
  session_state: string (optional)
}
```

**Indexes:**
- `by_userId` - Get all accounts for a user
- `by_provider_providerAccountId` - Unique OAuth account lookup

#### 3. `sessions` Table
```typescript
{
  sessionToken: string
  userId: Id<"users">
  expires: number
}
```

**Indexes:**
- `by_sessionToken` - Fast session lookup
- `by_userId` - Get all sessions for a user

#### 4. `verificationTokens` Table
```typescript
{
  identifier: string (email)
  token: string (UUID)
  expires: number
  type: "passwordReset" | "emailVerification"
}
```

**Indexes:**
- `by_identifier` - Get tokens by email
- `by_token` - Validate reset tokens

#### 5. Updated `progress` Table
```typescript
{
  userId: Id<"users"> // Changed from string to reference
  // ... rest of fields
}
```

## File Structure

```
project/
├── convex/
│   ├── auth.ts                    # Custom Convex DB helpers for NextAuth.js
│   ├── admin.ts                   # Admin-only operations
│   └── schema.ts                  # Updated with auth tables
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts   # NextAuth API handler
│   │   │   │   ├── forgot-password/
│   │   │   │   │   └── route.ts   # Password reset request
│   │   │   │   └── reset-password/
│   │   │   │       └── route.ts   # Password reset handler
│   │   │   └── admin/
│   │   │       └── users/
│   │   │           └── route.ts   # User management API
│   │   ├── auth/
│   │   │   ├── signin/
│   │   │   │   └── page.tsx       # Sign in page
│   │   │   ├── signup/
│   │   │   │   └── page.tsx       # Sign up page
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx       # Request reset page
│   │   │   ├── reset-password/
│   │   │   │   └── page.tsx       # Reset password page
│   │   │   └── error/
│   │   │       └── page.tsx       # Auth error page
│   │   ├── admin/
│   │   │   ├── layout.tsx         # Admin layout with guard
│   │   │   └── users/
│   │   │       └── page.tsx       # User management UI
│   │   ├── layout.tsx             # Root layout with SessionProvider
│   │   └── page.tsx               # Landing page with auth
│   ├── components/
│   │   ├── auth/
│   │   │   ├── SignInForm.tsx     # Email/password login
│   │   │   ├── SignUpForm.tsx     # Registration form
│   │   │   ├── OAuthButtons.tsx   # Google/GitHub buttons
│   │   │   ├── ForgotPasswordForm.tsx
│   │   │   ├── ResetPasswordForm.tsx
│   │   │   └── UserButton.tsx     # User dropdown menu
│   │   └── dashboard/
│   │       └── Navbar.tsx         # Updated with UserButton
│   └── lib/
│       ├── auth/
│       │   ├── auth.config.ts     # NextAuth configuration
│       │   ├── guards.ts          # Server-side auth guards
│       │   └── utils.ts           # Password hashing, validation
│       └── email/
│           ├── send.ts            # Email sending service
│           └── templates.ts       # Email HTML templates
├── middleware.ts                  # Route protection
├── AUTH_SETUP.md                  # Setup instructions
└── AUTH_IMPLEMENTATION.md         # This file
```

## Core Components

### 1. NextAuth Configuration (`src/lib/auth/auth.config.ts`)

Configures three authentication providers:

**Credentials Provider** (Email/Password):
- Sign in: Validates email/password against hashed password in database
- Sign up: Creates new user with hashed password
- Password validation: Min 8 chars, uppercase, lowercase, number

**Google Provider**:
- OAuth flow with Google
- Auto-creates user if doesn't exist
- Links account to existing user if email matches

**GitHub Provider**:
- OAuth flow with GitHub
- Auto-creates user if doesn't exist
- Links account to existing user if email matches

**Callbacks**:
- `signIn`: Creates/links accounts, updates user info
- `jwt`: Adds user ID and role to JWT token
- `session`: Exposes user data to client

### 2. Convex Database Helper Layer (`convex/auth.ts`)

**⚠️ Important**: This file provides custom Convex database operations for NextAuth.js. It is NOT related to the `@convex-dev/auth` package.

Provides database operations for NextAuth:

**User Operations**:
- `getUserByEmail`: Find user by email
- `getUserById`: Get user by ID
- `createUser`: Create new user account
- `updateUser`: Update user information

**Account Operations**:
- `linkAccount`: Link OAuth provider to user
- `getAccountByProvider`: Find OAuth account
- `unlinkAccount`: Remove OAuth link

**Session Operations**:
- `createSession`: Create user session
- `getSessionByToken`: Validate session
- `updateSession`: Refresh session expiry
- `deleteSession`: Logout user
- `deleteExpiredSessions`: Cleanup task

**Verification Token Operations**:
- `createVerificationToken`: Generate reset token
- `getVerificationToken`: Validate token
- `deleteVerificationToken`: Consume token
- `deleteExpiredVerificationTokens`: Cleanup task

### 3. Admin Layer (`convex/admin.ts`)

Admin-only operations with role verification:

- `listUsers`: Get all users with stats (enrollment count)
- `updateUserRole`: Promote/demote users (can't demote self)
- `deleteUser`: Remove user and all data (can't delete self)
- `getAdminStats`: Dashboard statistics

All mutations verify the current user is an admin before executing.

### 4. Auth Guards (`src/lib/auth/guards.ts`)

Server-side protection functions:

- `getSession()`: Get current session
- `requireAuth()`: Require authentication, redirect to signin
- `requireAdmin()`: Require admin role, redirect to dashboard
- `isAdmin()`: Check if user is admin (boolean)
- `getCurrentUser()`: Get current user from session

### 5. Middleware (`middleware.ts`)

Edge middleware that protects routes:
- `/dashboard/*` - Requires authentication
- `/learnspace/*` - Requires authentication
- `/admin/*` - Requires authentication (admin check in layout)

Automatically redirects unauthenticated users to `/auth/signin`.

## UI Components

### Authentication Forms

1. **SignInForm**: Email/password login with forgot password link
2. **SignUpForm**: Registration with password strength indicator
3. **OAuthButtons**: Google and GitHub OAuth buttons
4. **ForgotPasswordForm**: Request password reset email
5. **ResetPasswordForm**: Set new password with validation
6. **UserButton**: User avatar dropdown with profile and logout

### Authentication Pages

1. **Sign In** (`/auth/signin`): Login page with OAuth options
2. **Sign Up** (`/auth/signup`): Registration page with OAuth options
3. **Forgot Password** (`/auth/forgot-password`): Request reset link
4. **Reset Password** (`/auth/reset-password`): Set new password with token
5. **Error** (`/auth/error`): Display auth errors with helpful messages

### Admin Pages

1. **Users Management** (`/admin/users`):
   - List all users with search
   - View user stats (enrollments, join date)
   - Promote/demote user roles
   - Delete users
   - Real-time role updates

## Password Reset Flow

### 1. Request Reset
```
User enters email
    ↓
POST /api/auth/forgot-password
    ↓
Generate UUID token
    ↓
Store in verificationTokens table (24hr expiry)
    ↓
Send email with reset link
    ↓
Return success (even if email doesn't exist - security)
```

### 2. Reset Password
```
User clicks email link with token
    ↓
GET /auth/reset-password?token=xxx
    ↓
User enters new password
    ↓
POST /api/auth/reset-password
    ↓
Validate token (check expiry)
    ↓
Hash new password
    ↓
Update user password
    ↓
Delete used token
    ↓
Redirect to signin with success message
```

## Security Features

### Password Security
- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Min 8 chars, mixed case, numbers
- **Strength Indicator**: Real-time feedback on password strength

### Session Security
- **JWT Tokens**: Secure, HTTP-only cookies
- **Expiry**: 30-day session timeout
- **Refresh**: Auto-refresh on activity

### OAuth Security
- **CSRF Protection**: Built into NextAuth
- **Account Linking**: Safe email-based account linking
- **State Validation**: OAuth state parameter verification

### Admin Security
- **Role Verification**: Double-check on all admin actions
- **Self-Protection**: Can't demote or delete self
- **Audit Trail**: All changes logged in Convex

### Email Security
- **Token Expiry**: 24-hour reset window
- **Single Use**: Tokens deleted after use
- **No Email Enumeration**: Same response for existing/non-existing emails

## API Routes

### Public Routes

**POST /api/auth/forgot-password**
```typescript
Request: { email: string }
Response: { success: boolean, message: string }
```

**POST /api/auth/reset-password**
```typescript
Request: { token: string, password: string }
Response: { success: boolean, message: string }
```

### Admin Routes (Require Admin Role)

**GET /api/admin/users**
```typescript
Response: {
  users: Array<{
    id: string
    name: string
    email: string
    role: "user" | "admin"
    enrollmentCount: number
    createdAt: number
  }>
}
```

**PATCH /api/admin/users**
```typescript
Request: { targetUserId: string, newRole: "user" | "admin" }
Response: { user: User }
```

**DELETE /api/admin/users?userId=xxx**
```typescript
Response: { success: boolean, deletedUserId: string }
```

## Environment Variables

Required:
- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL
- `NEXTAUTH_URL`: App URL
- `NEXTAUTH_SECRET`: Secret for JWT signing

Optional (for OAuth):
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth secret
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth secret

Optional (for email):
- `EMAIL_SERVER_HOST`: SMTP host
- `EMAIL_SERVER_PORT`: SMTP port
- `EMAIL_SERVER_USER`: SMTP username
- `EMAIL_SERVER_PASSWORD`: SMTP password
- `EMAIL_FROM`: From email address

## Usage Examples

### Protecting a Server Component

```typescript
import { requireAuth } from "@/lib/auth/guards";

export default async function ProtectedPage() {
  const session = await requireAuth();
  
  return <div>Welcome {session.user.name}</div>;
}
```

### Protecting an Admin Component

```typescript
import { requireAdmin } from "@/lib/auth/guards";

export default async function AdminPage() {
  const { session, user } = await requireAdmin();
  
  return <div>Admin: {user.name}</div>;
}
```

### Client-Side Session Access

```typescript
"use client";
import { useSession } from "next-auth/react";

export function UserProfile() {
  const { data: session, status } = useSession();
  
  if (status === "loading") return <div>Loading...</div>;
  if (!session) return <div>Not signed in</div>;
  
  return <div>Hello {session.user.name}</div>;
}
```

### Sign Out

```typescript
"use client";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/auth/signin" })}>
      Sign Out
    </button>
  );
}
```

## Admin Setup

### Creating the First Admin

1. Deploy the schema to Convex: `npx convex dev`
2. Sign up through the UI: `/auth/signup`
3. Open Convex dashboard
4. Navigate to `users` table
5. Find your user record
6. Change `role` from `"user"` to `"admin"`
7. Save changes
8. Refresh the app - you now have admin access!

### Promoting Other Users

1. Sign in as admin
2. Go to `/admin/users`
3. Find the user to promote
4. Click the three-dot menu
5. Select "Promote to Admin"
6. Confirm the action

## Testing Checklist

- [x] Email/password signup creates user
- [x] Email/password login works
- [x] Google OAuth signup/login works
- [x] GitHub OAuth signup/login works
- [x] Password reset email sent
- [x] Password reset with valid token works
- [x] Password reset token expiry handled
- [x] Protected routes redirect to signin
- [x] Admin pages only accessible by admins
- [x] Admin can promote users to admin
- [x] User session persists across page reloads
- [x] Logout works correctly
- [x] Duplicate email registration prevented
- [x] Invalid password rejected
- [x] Weak passwords rejected
- [x] OAuth account linking works
- [x] Admin cannot demote themselves
- [x] Admin cannot delete themselves

## Future Enhancements

Potential improvements:

1. **Email Verification**: Require email confirmation before access
2. **Two-Factor Authentication**: Add 2FA support
3. **Social Logins**: Add more OAuth providers (Microsoft, Apple)
4. **Rate Limiting**: Prevent brute force attacks
5. **Audit Logs**: Track all admin actions
6. **User Impersonation**: Admin ability to view as user
7. **Bulk Actions**: Bulk user management operations
8. **Advanced Roles**: More granular permissions system
9. **Account Deletion**: User-initiated account deletion
10. **Export Data**: GDPR-compliant data export

## Troubleshooting

### Common Issues

**OAuth redirect errors**:
- Verify callback URLs match in provider settings
- Check environment variables are loaded
- Ensure NEXTAUTH_URL is correct

**Email not sending**:
- Verify SMTP credentials
- Check email service logs
- Test with ethereal.email for development

**Admin access denied**:
- Confirm role is "admin" in database
- Clear browser cookies
- Check JWT token has correct role

**Session not persisting**:
- Verify SessionProvider wraps app
- Check cookie settings in browser
- Ensure NEXTAUTH_SECRET is set

## License

This implementation follows the MIT License of the parent project.

## Credits

Built with:
- NextAuth.js - Authentication framework
- Convex - Backend database
- bcryptjs - Password hashing
- nodemailer - Email service
- React - UI framework
- Next.js - App framework

