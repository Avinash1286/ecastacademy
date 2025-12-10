# ECAST Academy

<div align="center">

![ECAST Academy](https://img.shields.io/badge/ECAST-Academy-7c3aed?style=for-the-badge)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Convex](https://img.shields.io/badge/Convex-Backend-orange?style=flat-square)](https://convex.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)

**AI-Powered Learning Platform - Learn smarter with personalized courses and capsules**

[Getting Started](#getting-started) • [Features](#features) • [Tech Stack](#tech-stack) • [Documentation](#documentation)

</div>

---

## 📖 Overview

ECAST Academy is a modern, AI-powered learning platform that transforms YouTube videos and custom content into interactive courses with quizzes, notes, and certifications. Built with Next.js 15, Convex, and advanced AI capabilities, it provides a seamless learning experience with features like:

- 🎬 **YouTube Integration** - Import and transform YouTube videos into structured courses
- 🧠 **AI-Powered Content** - Auto-generate quizzes, notes, and learning capsules using Google Gemini and OpenAI
- 📱 **Progressive Web App** - Install and use offline on any device
- 🏆 **Certifications** - Earn certificates upon course completion
- 📊 **Progress Tracking** - Detailed analytics and progress visualization

## ✨ Features

### 🎓 Course Management
- **Admin Portal**: Create and organize courses with chapters and content items
- Support for multiple content types: videos, text, quizzes, assignments, and resources
- Drag-and-drop course builder for admins
- Course publishing and draft management
- **User Experience**: Browse, enroll, and complete courses to earn certifications

### 📺 YouTube Learning
- Admin-curated courses from YouTube videos
- Automatic transcript extraction and processing
- AI-generated notes and summaries
- Interactive video player with chapter markers
- Users can browse and enroll in available courses

### 💊 Learning Capsules
- Bite-sized learning modules
- AI-generated content from various sources
- Multiple quiz types: MCQ, Fill-in-the-Blanks, Drag-and-Drop
- Spaced repetition for better retention

### 📝 Interactive Quizzes
- Multiple question types with detailed feedback
- Timed assessments
- Retry capabilities with score tracking
- Graded and ungraded quiz options

### 🏅 Certification System
- Course completion certificates
- Grading and passing criteria
- Unique certificate IDs for verification
- Downloadable certificate generation

### 🔐 Authentication & Security
- Clerk authentication integration
- Role-based access control (User/Admin)
- Secure API routes with rate limiting
- CSRF protection

### 📱 Progressive Web App (PWA)
- Installable on desktop and mobile
- Offline support with service workers
- Push notifications ready
- Responsive design for all screen sizes

### 🎨 User Experience
- Dark/Light theme toggle
- Smooth animations with Framer Motion
- Accessible UI components (Radix UI)
- Sound effects for interactions

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Language**: [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Forms**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Rich Text Editor**: [TipTap](https://tiptap.dev/)
- **Charts**: [Recharts](https://recharts.org/)

### Backend
- **Database & Backend**: [Convex](https://convex.dev/)
- **Authentication**: [Clerk](https://clerk.com/)
- **AI Integration**: 
  - [Google Gemini](https://ai.google.dev/)
  - [OpenAI GPT](https://openai.com/)
  - [Vercel AI SDK](https://sdk.vercel.ai/)

### Infrastructure
- **PWA**: [@ducanh2912/next-pwa](https://www.npmjs.com/package/@ducanh2912/next-pwa)
- **Rate Limiting**: [Upstash Redis](https://upstash.com/)

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- [Convex Account](https://convex.dev/)
- [Clerk Account](https://clerk.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Avinash1286/ecastacademy.git
   cd ecastacademy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Fill in your environment variables (see [Environment Variables](#environment-variables) section)

4. **Set up Convex**
   ```bash
   npx convex dev
   ```
   
   This will prompt you to log in and create a new project if needed.

5. **Run the development server**
   ```bash
   npm run dev
   ```

   This runs both Next.js and Convex in development mode.

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# Clerk Authentication (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Convex (Required)
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# AI Providers (At least one required)
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=sk-your_openai_api_key

# YouTube API (Required for video import)
YOUTUBE_API_KEY=your_youtube_api_key

# Rate Limiting - Upstash Redis (Required in production)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Convex Environment Variables

Set these directly in Convex:

```bash
npx convex env set CERTIFICATE_SIGNING_SECRET "your-secure-secret"
```

## 📁 Project Structure

```
ecastacademy/
├── convex/                 # Convex backend
│   ├── schema.ts          # Database schema
│   ├── courses.ts         # Course operations
│   ├── chapters.ts        # Chapter operations
│   ├── videos.ts          # Video processing
│   ├── certificates.ts    # Certificate generation
│   ├── progress.ts        # Progress tracking
│   ├── ai.ts              # AI operations
│   └── utils/             # Backend utilities
├── shared/                # Shared code (frontend & backend)
│   ├── ai/               # AI utilities and prompts
│   ├── quiz/             # Quiz types and utilities
│   └── visualization/    # Chart templates
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── admin/        # Admin dashboard
│   │   ├── dashboard/    # User dashboard
│   │   ├── learnspace/   # Learning interface
│   │   ├── capsule/      # Capsule learning
│   │   └── api/          # API routes
│   ├── components/       # React components
│   │   ├── ui/           # Base UI components
│   │   ├── course/       # Course components
│   │   ├── quiz/         # Quiz components
│   │   └── landing/      # Landing page components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and services
│   └── context/          # React context providers
└── public/               # Static assets
    ├── icons/            # PWA icons
    └── images/           # Static images
```

## 📜 Available Scripts

```bash
# Development (runs Next.js + Convex)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Convex development server only
npm run convex:dev
```

## 🔧 Configuration

### Clerk Setup

1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable the authentication methods you want (Email, Google, etc.)
3. Copy your API keys to `.env.local`

### Convex Setup

1. Run `npx convex dev` to initialize your Convex project
2. The schema will be automatically deployed
3. Set any required environment variables using `npx convex env set`

### AI Provider Setup

**Google Gemini:**
1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add `GEMINI_API_KEY` to your environment

**OpenAI:**
1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Add `OPENAI_API_KEY` to your environment

### YouTube API Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the YouTube Data API v3
3. Create an API key and add it as `YOUTUBE_API_KEY`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This is open source project.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Convex](https://convex.dev/) - Backend platform
- [Clerk](https://clerk.com/) - Authentication
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [shadcn/ui](https://ui.shadcn.com/) - UI component library

---

<div align="center">
Made with ❤️ by ECAST Team at Thapathali Campus
</div>
