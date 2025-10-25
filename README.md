# Ecast Academy 🎓

Ecast Academy is a modern, AI-powered e-learning platform built with Next.js 15, Convex, and Google Gemini. It transforms any YouTube video or playlist into a fully interactive course, complete with detailed notes and quizzes, all generated automatically by AI.

![Alt Text](https://drive.google.com/uc?export=view&id=1pvJzPeAnQvK9W3fR3q2xM9fRv9cFIX_5)

## 📖 Documentation

- **[Architecture Overview](./ARCHITECTURE_OVERVIEW.md)** - Complete system architecture and tech stack
- **[Authentication Guide](./AUTH_IMPLEMENTATION.md)** - Authentication implementation details
- **[Convex Migration](./CONVEX_MIGRATION_COMPLETE.md)** - Database migration notes


## 🚀 Tech Stack

-   **Framework**: [Next.js](https://nextjs.org/) 15 (App Router & Turbopack)
-   **Database**: [Convex](https://convex.dev/) (Real-time backend)
-   **Authentication**: [NextAuth.js](https://next-auth.js.org/) v5 (NOT Convex Auth)
-   **AI**: [Google Gemini](https://ai.google.dev/)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
-   **Forms**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)

## 🔐 Authentication

**Authentication System**: NextAuth.js v5 with Convex Backend

- **NOT using Convex Auth package** (`@convex-dev/auth`)
- Using **NextAuth.js** as the primary authentication library
- Convex serves as the database backend via custom helper functions
- The `convex/auth.ts` file contains custom Convex queries/mutations for NextAuth.js

Features:
- Email/Password authentication
- OAuth (Google & GitHub)
- Password reset functionality
- Role-based access control (User/Admin)
- Session management with JWT

For details, see:
- [Architecture Overview](./ARCHITECTURE_OVERVIEW.md)
- [Authentication Setup](./AUTH_SETUP.md)
- [Implementation Guide](./AUTH_IMPLEMENTATION.md)
- [Summary](./AUTHENTICATION_SUMMARY.md)

## 🗄️ Database

-   **Framework**: [Next.js](https://nextjs.org/) 15 (App Router & Turbopack)
-   **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Neon](https://neon.tech/))
-   **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
-   **AI**: [Google Gemini](https://ai.google.dev/)
-   **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
-   **UI Components**: [Shadcn/ui](https://ui.shadcn.com/)
-   **Forms**: [React Hook Form](https://react-hook-form.com/) & [Zod](https://zod.dev/)
-   **Language**: [TypeScript](https://www.typescriptlang.org/)

## ⚙️ Getting Started: Quick Setup

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### 1. Prerequisites

Make sure you have the following installed on your machine:
-   [Node.js](https://nodejs.org/) (v20.x or higher recommended)
-   [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), or [pnpm](https://pnpm.io/)
-   [Git](https://git-scm.com/)

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/ecast-academy.git
cd ecastacademy
```

### 3. Install Dependencies

Install the project dependencies using your preferred package manager.

```bash
npm install
```

### 4. Set Up Environment Variables

Create a `.env` file in the root of your project by copying the example file:

```bash
cp .env.example .env
```

Now, fill in the `.env` file with your credentials:

```ini
# .env

# Database Connection String (from Neon)
DATABASE_URL="postgres://..."

# Google Gemini API Key (from Google AI Studio)
GEMINI_API_KEY="your_gemini_api_key"

# YouTube Data API v3 Key (from Google Cloud Console)
NEXT_PUBLIC_YOUTUBE_API_KEY="your_youtube_api_key"
```

-   **`DATABASE_URL`**: Get this from your [Neon](https://neon.tech/) project dashboard.
-   **`GEMINI_API_KEY`**: Obtain this from the [Google AI Studio](https://aistudio.google.com/app/apikey).
-   **`NEXT_PUBLIC_YOUTUBE_API_KEY`**: Get this from the [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com). You need to enable the "YouTube Data API v3".

### 5. Database Setup

This project uses Drizzle ORM to manage the database schema. Once your `DATABASE_URL` is set, you can push the schema to your Neon database.

Run the following command to sync your database with the schema defined in `src/db/schema.ts`:

```bash
npx drizzle-kit push
```

This will create the necessary tables (`courses`, `videos`, `chapters`) in your database.

### 6. Run the Development Server

You are now ready to start the development server.

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000). The development server uses **Turbopack** for maximum speed.

## 📂 Project Structure

The project follows a feature-colocated structure within the Next.js App Router paradigm.

```
src
├── app/                # Next.js App Router (Pages & API Routes)
│   ├── api/            # API endpoints for courses, transcripts, etc.
│   ├── dashboard/      # Dashboard pages (explore, create, etc.)
│   └── learnspace/     # The interactive learning interface
│
├── components/         # React components
│   ├── create/         # Components for the course creation page
│   ├── dashboard/      # Components for the main dashboard
│   ├── learnspace/     # Components for the learning interface
│   └── ui/             # Re-usable UI components (from Shadcn/ui)
│
├── context/            # React Context providers
│
├── db/                 # Drizzle ORM setup
│   ├── queries/        # Encapsulated database queries
│   └── schema.ts       # Database schema definition
│
├── hooks/              # Custom React hooks
│
└── lib/                # Core libraries, utilities, and services
    ├── services/       # Business logic (AI, YouTube API, Course service)
    ├── validators/     # Zod schemas for data validation
    ├── prompts.ts      # Prompts for the Google Gemini API
    └── utils.ts        # Shared utility functions
```
