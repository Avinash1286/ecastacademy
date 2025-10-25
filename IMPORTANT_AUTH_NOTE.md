# ⚠️ IMPORTANT: Authentication Implementation Note

## We DO NOT Use Convex Auth

This project uses **NextAuth.js**, NOT the `@convex-dev/auth` package (Convex Auth).

### Quick Reference

| What | Used? | Purpose |
|------|-------|---------|
| **NextAuth.js** (`next-auth`) | ✅ YES | Primary authentication system |
| **Convex Auth** (`@convex-dev/auth`) | ❌ NO | Not installed or used |
| **`convex/auth.ts` file** | ✅ YES | Custom database helpers for NextAuth.js |
| **Convex Database** | ✅ YES | Backend storage for users, sessions, etc. |

---

## Why the Confusion?

The file `convex/auth.ts` might be confusing because:

1. ❌ **It's NOT** the Convex Auth package (`@convex-dev/auth`)
2. ✅ **It IS** a custom file with Convex queries/mutations for NextAuth.js
3. The name "auth.ts" is just a descriptive filename, not related to Convex Auth

---

## Our Authentication Stack

```
┌─────────────────────────────────────┐
│         NextAuth.js v5              │  ← Authentication Logic
│     (next-auth package)             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      convex/auth.ts                 │  ← Custom Database Helpers
│  (Convex queries & mutations)       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Convex Database                │  ← Data Storage
│  (users, sessions, accounts)        │
└─────────────────────────────────────┘
```

---

## What's in `convex/auth.ts`?

This file contains custom Convex functions that NextAuth.js uses:

```typescript
// User operations
export const getUserByEmail = query(...)    // Find user by email
export const getUserById = query(...)       // Get user by ID
export const createUser = mutation(...)     // Create new user
export const updateUser = mutation(...)     // Update user info

// OAuth account linking
export const linkAccount = mutation(...)    // Link OAuth provider
export const getAccountByProvider = query(...)

// Session management
export const createSession = mutation(...)  // Create user session
export const getSessionByToken = query(...) // Validate session
export const deleteSession = mutation(...)  // Logout

// Password reset
export const createVerificationToken = mutation(...)
export const getVerificationToken = query(...)
export const deleteVerificationToken = mutation(...)
```

These are **NOT** from the Convex Auth package. They are **custom functions** we wrote to integrate NextAuth.js with Convex.

---

## Key Files

### Authentication Configuration
- `src/lib/auth/auth.config.ts` - NextAuth.js configuration
- `src/lib/auth/guards.ts` - Server-side auth guards
- `src/lib/auth/utils.ts` - Password hashing utilities

### Convex Backend
- `convex/auth.ts` - Custom database helpers for NextAuth.js
- `convex/admin.ts` - Admin operations
- `convex/schema.ts` - Database schema (includes auth tables)

### Middleware & Routes
- `middleware.ts` - Route protection
- `src/app/api/auth/[...nextauth]/route.ts` - NextAuth API handler

---

## Package Dependencies

In `package.json`:

```json
{
  "dependencies": {
    "next-auth": "^5.0.0-beta.29",     // ✅ PRIMARY AUTH PACKAGE
    "convex": "^1.28.0",                // ✅ DATABASE BACKEND
    "bcryptjs": "^3.0.2",               // ✅ Password hashing
    "nodemailer": "^6.10.1"             // ✅ Email service
    // NO @convex-dev/auth package!
  }
}
```

**Notice**: `@convex-dev/auth` is **NOT** in the dependencies!

---

## Why NextAuth.js Instead of Convex Auth?

1. **More mature**: NextAuth.js is more established and widely used
2. **Better OAuth support**: Extensive OAuth provider support
3. **Framework agnostic**: Works with any backend, not just Convex
4. **Rich ecosystem**: More community plugins and examples
5. **Flexibility**: Can switch databases without changing auth logic

---

## For New Developers

If you're new to this project:

1. ✅ Read [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) first
2. ✅ Then read [AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)
3. ✅ Understand that `convex/auth.ts` is just database helpers
4. ✅ All authentication logic is in NextAuth.js configuration
5. ❌ Don't look for Convex Auth documentation - we don't use it!

---

## Common Questions

### Q: Can I use Convex Auth instead?
**A**: You could, but you'd need to completely rewrite the authentication system. We chose NextAuth.js for the reasons listed above.

### Q: Should I rename `convex/auth.ts` to avoid confusion?
**A**: You could rename it to `convex/users.ts` or `convex/authHelpers.ts` if you prefer. The name is just descriptive.

### Q: Where is the authentication logic?
**A**: In `src/lib/auth/auth.config.ts` (NextAuth.js configuration) and the callbacks defined there.

### Q: Can I add more OAuth providers?
**A**: Yes! Add them in `src/lib/auth/auth.config.ts` following the NextAuth.js documentation.

---

## Summary

✅ **We use**: NextAuth.js with Convex as the database backend  
❌ **We don't use**: Convex Auth (`@convex-dev/auth`)  
📁 **`convex/auth.ts`**: Custom database helpers, not the Convex Auth package  

---

**If you have questions**, refer to:
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Convex Documentation](https://docs.convex.dev)
- [AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)
