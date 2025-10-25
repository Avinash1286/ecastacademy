# ECAST Academy - Architecture Overview

## 🎯 Quick Summary

**Frontend**: Next.js 15 with React 19  
**Backend/Database**: Convex  
**Authentication**: NextAuth.js v5 (NOT Convex Auth)  
**Styling**: Tailwind CSS

---

## 🔐 Authentication Architecture

### Important Clarification

**We DO NOT use Convex Auth (`@convex-dev/auth` package)**

Instead, we use:
- **Primary Auth Package**: `next-auth` (NextAuth.js v5)
- **Database Backend**: Convex (custom helper functions)
- **Custom Helpers**: `convex/auth.ts` provides database operations for NextAuth.js

### How It Works

```
User Action (Sign In/Sign Up)
         ↓
    NextAuth.js
    (Handles auth logic, OAuth, JWT)
         ↓
    convex/auth.ts
    (Custom Convex queries/mutations)
         ↓
    Convex Database
    (Stores users, sessions, accounts)
         ↓
    JWT Session Cookie
    (User authenticated)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/auth/auth.config.ts` | NextAuth.js configuration (providers, callbacks) |
| `convex/auth.ts` | Custom Convex database helpers for NextAuth.js |
| `convex/admin.ts` | Admin operations with role verification |
| `middleware.ts` | Route protection middleware |
| `src/lib/auth/guards.ts` | Server-side auth guards |

### Authentication Features

✅ Email/Password authentication  
✅ Google OAuth login  
✅ GitHub OAuth login  
✅ Password reset via email  
✅ Role-based access control (User/Admin)  
✅ Session management with JWT  
✅ Protected routes  

---

## 🗄️ Database (Convex)

### Tables

**Authentication Tables** (used by NextAuth.js):
- `users` - User accounts with roles
- `accounts` - OAuth provider linking
- `sessions` - Active user sessions
- `verificationTokens` - Password reset tokens

**Application Tables**:
- `courses` - Course information
- `chapters` - Course chapters
- `videos` - YouTube video data
- `contentItems` - Course content (lessons, quizzes, etc.)
- `progress` - User learning progress

### Key Convex Files

| File | Purpose |
|------|---------|
| `convex/schema.ts` | Database schema definitions |
| `convex/courses.ts` | Course CRUD operations |
| `convex/videos.ts` | Video management |
| `convex/chapters.ts` | Chapter operations |
| `convex/contentItems.ts` | Content item management |
| `convex/auth.ts` | Auth database helpers (for NextAuth.js) |
| `convex/admin.ts` | Admin-only operations |

---

## 📁 Project Structure

```
ecastacademy/
├── convex/                      # Convex backend
│   ├── schema.ts               # Database schema
│   ├── auth.ts                 # NextAuth.js database helpers
│   ├── admin.ts                # Admin operations
│   ├── courses.ts              # Course operations
│   ├── videos.ts               # Video operations
│   ├── chapters.ts             # Chapter operations
│   └── contentItems.ts         # Content operations
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── auth/              # Auth pages (signin, signup, etc.)
│   │   ├── dashboard/         # User dashboard
│   │   ├── admin/             # Admin panel
│   │   ├── learnspace/        # Learning interface
│   │   └── api/               # API routes
│   │
│   ├── components/            # React components
│   │   ├── auth/             # Auth forms & buttons
│   │   ├── dashboard/        # Dashboard UI
│   │   ├── learnspace/       # Learning UI
│   │   └── ui/               # Reusable UI components
│   │
│   ├── lib/                  # Utilities & services
│   │   ├── auth/            # Auth config & guards
│   │   ├── email/           # Email service
│   │   └── services/        # Business logic
│   │
│   └── hooks/               # Custom React hooks
│
├── middleware.ts            # Route protection
├── package.json            # Dependencies
└── *.md                    # Documentation
```

---

## 🔄 Data Flow

### Authentication Flow
```
1. User submits login form
2. NextAuth.js validates credentials
3. NextAuth.js calls convex/auth.ts functions
4. Convex database validates/stores data
5. NextAuth.js generates JWT token
6. User redirected to dashboard
```

### Course Creation Flow
```
1. Admin creates course via UI
2. Client calls useMutation(api.courses.createCourse)
3. Convex validates and stores course
4. Real-time update to all clients
5. UI automatically updates
```

### Learning Flow
```
1. User opens learnspace
2. Client queries course data via Convex
3. User watches video/reads content
4. Progress automatically saved to Convex
5. Real-time sync across devices
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Convex
```bash
npx convex dev
```
Copy the generated URL to `.env.local` as `NEXT_PUBLIC_CONVEX_URL`

### 3. Set Up Environment Variables
Create `.env.local`:
```env
# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret_here

# OAuth (optional)
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
GITHUB_CLIENT_ID=your_github_id
GITHUB_CLIENT_SECRET=your_github_secret

# Email (optional)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your_email
EMAIL_SERVER_PASSWORD=your_password
```

### 4. Run Development Server
```bash
npm run dev
```

This starts:
- Next.js dev server on `http://localhost:3000`
- Convex dev server (watch mode)

### 5. Create Admin User
1. Go to `http://localhost:3000/auth/signup`
2. Create an account
3. Open Convex dashboard
4. Find your user in `users` table
5. Change `role` to `"admin"`

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project overview & setup |
| [AUTH_SETUP.md](./AUTH_SETUP.md) | Authentication setup guide |
| [AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md) | Detailed auth implementation |
| [AUTHENTICATION_SUMMARY.md](./AUTHENTICATION_SUMMARY.md) | Auth feature summary |
| [CONVEX_MIGRATION_COMPLETE.md](./CONVEX_MIGRATION_COMPLETE.md) | Convex migration notes |
| [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) | This file |

---

## ⚠️ Common Misconceptions

### ❌ "This uses Convex Auth"
**FALSE** - We use NextAuth.js, not the `@convex-dev/auth` package.

### ❌ "convex/auth.ts is Convex Auth"
**FALSE** - `convex/auth.ts` contains custom helper functions for NextAuth.js to interact with Convex database.

### ✅ "This uses NextAuth.js with Convex as the database"
**CORRECT** - NextAuth.js handles authentication, Convex stores the data.

---

## 🛠️ Technology Stack

### Frontend
- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Radix UI components

### Backend
- Convex (database & backend functions)
- Next.js API routes

### Authentication
- NextAuth.js v5
- bcryptjs (password hashing)
- nodemailer (email service)

### AI Features
- Google Gemini AI
- OpenAI (optional)

### Development
- ESLint
- TypeScript
- npm-run-all

---

## 📞 Support

For questions about:
- **Authentication**: See [AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)
- **Convex**: Visit [docs.convex.dev](https://docs.convex.dev)
- **NextAuth.js**: Visit [next-auth.js.org](https://next-auth.js.org)

---

**Last Updated**: October 24, 2025
