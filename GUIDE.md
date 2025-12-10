# ECAST Academy - Vercel Deployment Guide

<div align="center">

![Vercel](https://img.shields.io/badge/Deploy%20to-Vercel-black?style=for-the-badge&logo=vercel)

**Complete step-by-step guide to deploy ECAST Academy on Vercel**

</div>

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Prepare Your Repository](#step-1-prepare-your-repository)
3. [Step 2: Set Up Clerk Authentication](#step-2-set-up-clerk-authentication)
4. [Step 3: Set Up Convex Backend](#step-3-set-up-convex-backend)
5. [Step 4: Set Up AI Providers](#step-4-set-up-ai-providers)
6. [Step 5: Set Up YouTube API](#step-5-set-up-youtube-api)
7. [Step 6: Set Up Upstash Redis (Rate Limiting)](#step-6-set-up-upstash-redis-rate-limiting)
8. [Step 7: Deploy to Vercel](#step-7-deploy-to-vercel)
9. [Step 8: Configure Convex for Production](#step-8-configure-convex-for-production)
10. [Step 9: Post-Deployment Configuration](#step-9-post-deployment-configuration)
11. [Troubleshooting](#troubleshooting)
12. [Environment Variables Reference](#environment-variables-reference)

---

## Prerequisites

Before starting, ensure you have:

- ✅ A [GitHub](https://github.com) account with your repository pushed
- ✅ A [Vercel](https://vercel.com) account (free tier works)
- ✅ A [Clerk](https://clerk.com) account (free tier available)
- ✅ A [Convex](https://convex.dev) account (free tier available)
- ✅ A [Google Cloud](https://console.cloud.google.com) account (for YouTube API & Gemini)
- ✅ An [OpenAI](https://platform.openai.com) account (optional, for GPT models)
- ✅ An [Upstash](https://upstash.com) account (for rate limiting in production)

---

## Step 1: Prepare Your Repository

### 1.1 Push to GitHub

If you haven't already, push your code to GitHub:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ecastacademy.git
git push -u origin main
```

### 1.2 Verify Project Structure

Ensure your project has these essential files:
- `package.json` - with correct build scripts
- `next.config.ts` - Next.js configuration
- `convex/` folder - Convex backend code
- `.env.local.example` - template for environment variables

### 1.3 Update `.gitignore`

Make sure sensitive files are ignored:

```gitignore
# Environment files
.env
.env.local
.env.production
convex_keys.env

# Convex
.convex/
```

---

## Step 2: Set Up Clerk Authentication

### 2.1 Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Click **"Create application"**
3. Enter your application name: `ECAST Academy`
4. Select authentication methods:
   - ✅ Email
   - ✅ Google (recommended)
   - ✅ GitHub (optional)
5. Click **"Create application"**

### 2.2 Get API Keys

1. In Clerk Dashboard, go to **API Keys**
2. Copy these values:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_`)
   - `CLERK_SECRET_KEY` (starts with `sk_`)

### 2.3 Configure Clerk URLs

In Clerk Dashboard → **Paths**:

| Setting | Value |
|---------|-------|
| Sign-in URL | `/sign-in` |
| Sign-up URL | `/sign-up` |
| After sign-in URL | `/dashboard` |
| After sign-up URL | `/dashboard` |

### 2.4 Configure Production Domain (After Vercel Deploy)

After deploying to Vercel:
1. Go to Clerk Dashboard → **Domains**
2. Add your production domain: `your-app.vercel.app`
3. For custom domains, add those too

---

## Step 3: Set Up Convex Backend

### 3.1 Create Convex Project

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Click **"Create a project"**
3. Name it: `ecast-academy`
4. Select your team/organization

### 3.2 Get Convex Credentials

1. In your Convex project, go to **Settings** → **URL & Deploy Key**
2. Copy:
   - `Deployment URL` (e.g., `https://your-project-123.convex.cloud`)
   - `Deploy Key` (for CI/CD deployment)

### 3.3 Deploy Convex Schema

Run locally to deploy your schema:

```bash
# Login to Convex
npx convex login

# Deploy to production
npx convex deploy --prod
```

### 3.4 Set Convex Environment Variables

Set environment variables in Convex Dashboard → **Settings** → **Environment Variables**:

```bash
# Or via CLI:
npx convex env set CERTIFICATE_SIGNING_SECRET "$(openssl rand -base64 48)" --prod
```

---

## Step 4: Set Up AI Providers

### 4.1 Google Gemini API

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Select or create a Google Cloud project
4. Copy the API key

> **Note**: Gemini API has a generous free tier suitable for development and small-scale production.

### 4.2 OpenAI API (Optional)

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Name it: `ECAST Academy Production`
4. Copy the key immediately (it won't be shown again)

> **Note**: OpenAI requires a paid account with credits.

---

## Step 5: Set Up YouTube API

### 5.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Name: `ECAST Academy`
4. Click **"Create"**

### 5.2 Enable YouTube Data API

1. Go to **APIs & Services** → **Library**
2. Search for **"YouTube Data API v3"**
3. Click on it and press **"Enable"**

### 5.3 Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"API Key"**
3. Copy the API key
4. (Recommended) Click **"Edit API key"** to restrict it:
   - Under **API restrictions**, select **"Restrict key"**
   - Choose **"YouTube Data API v3"**
   - Click **"Save"**

---

## Step 6: Set Up Upstash Redis (Rate Limiting)

### 6.1 Create Upstash Database

1. Go to [Upstash Console](https://console.upstash.com)
2. Click **"Create Database"**
3. Configure:
   - Name: `ecast-academy-ratelimit`
   - Type: **Regional**
   - Region: Choose closest to your users (or Vercel deployment region)
4. Click **"Create"**

### 6.2 Get Credentials

1. In your database dashboard, find:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
2. Copy both values

---

## Step 7: Deploy to Vercel

### 7.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Select **"Import Git Repository"**
4. Find and select your `ecastacademy` repository
5. Click **"Import"**

### 7.2 Configure Project Settings

On the configuration page:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `./` (default) |
| Build Command | `npm run build` (default) |
| Output Directory | `.next` (default) |
| Install Command | `npm install` (default) |

### 7.3 Add Environment Variables

Click **"Environment Variables"** and add ALL of these:

#### Clerk Authentication
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

#### Convex
```
CONVEX_DEPLOYMENT=prod:your-project-name
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
```

#### AI Providers
```
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=sk-your_openai_key
```

#### YouTube
```
YOUTUBE_API_KEY=your_youtube_api_key
```

#### Upstash Redis
```
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

#### App Configuration
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

> ⚠️ **Important**: Replace `your-app.vercel.app` with your actual Vercel URL after first deployment, then redeploy.

### 7.4 Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 2-5 minutes)
3. Note your deployment URL: `https://your-app.vercel.app`

---

## Step 8: Configure Convex for Production

### 8.1 Link Convex to Vercel Deployment

After your Vercel deployment:

```bash
# Set the production URL in Convex
npx convex env set SITE_URL "https://your-app.vercel.app" --prod
```

### 8.2 Deploy Convex Functions

```bash
# Deploy all Convex functions to production
npx convex deploy --prod
```

### 8.3 Verify Convex Connection

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Select your project
3. Check **Logs** to ensure functions are running
4. Verify **Data** tab shows your tables

---

## Step 9: Post-Deployment Configuration

### 9.1 Update App URL

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_APP_URL` to your actual Vercel URL
3. Trigger a redeploy: **Deployments** → **...** → **Redeploy**

### 9.2 Configure Clerk Production Domain

1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → Your App
2. Navigate to **Domains**
3. Add your Vercel domain: `your-app.vercel.app`
4. If using a custom domain, add that too

### 9.3 Set Up Custom Domain (Optional)

1. In Vercel Dashboard → **Settings** → **Domains**
2. Add your custom domain: `academy.yourdomain.com`
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` to your custom domain
5. Add domain to Clerk Dashboard

### 9.4 Create Admin User

1. Visit your deployed app and sign up
2. Access Convex Dashboard → **Data** → **users** table
3. Find your user and change `role` from `"user"` to `"admin"`
4. Save the change

Alternatively, use Convex Dashboard → **Functions** to run:
```javascript
// In Convex Dashboard, run a mutation to update user role
```

### 9.5 Test the Deployment

Verify all features work:

- [ ] Landing page loads correctly
- [ ] Sign up/Sign in works
- [ ] Dashboard loads after authentication
- [ ] Admin can access `/admin` routes
- [ ] Course creation works (admin)
- [ ] Video import from YouTube works (admin)
- [ ] AI-generated content works
- [ ] User enrollment works
- [ ] Progress tracking works
- [ ] Certificate generation works
- [ ] PWA installation works

---

## Troubleshooting

### Build Failures

**Error: Module not found**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

**Error: TypeScript errors**
```bash
# Check for type errors locally
npm run lint
npx tsc --noEmit
```

### Convex Connection Issues

**Error: Convex deployment not found**
- Verify `CONVEX_DEPLOYMENT` matches your Convex project
- Ensure you've run `npx convex deploy --prod`

**Error: Convex functions failing**
- Check Convex Dashboard → Logs for detailed errors
- Verify all environment variables are set in Convex

### Clerk Authentication Issues

**Error: Clerk publishable key not found**
- Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set (note the `NEXT_PUBLIC_` prefix)
- Redeploy after adding environment variables

**Error: Invalid Clerk domain**
- Add your Vercel domain to Clerk Dashboard → Domains
- For production, use production API keys (not test keys)

### API Issues

**YouTube API quota exceeded**
- Check [Google Cloud Console](https://console.cloud.google.com) for quota usage
- Request quota increase if needed

**AI API errors**
- Verify API keys are valid and have credits
- Check rate limits on your AI provider dashboard

### PWA Issues

**Service worker not registering**
- PWA is disabled in development by default
- Test in production deployment

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | Clerk Dashboard |
| `CLERK_SECRET_KEY` | Clerk secret key | Clerk Dashboard |
| `CONVEX_DEPLOYMENT` | Convex deployment name | Convex Dashboard |
| `NEXT_PUBLIC_CONVEX_URL` | Convex API URL | Convex Dashboard |
| `GEMINI_API_KEY` | Google Gemini API key | Google AI Studio |
| `YOUTUBE_API_KEY` | YouTube Data API key | Google Cloud Console |
| `NEXT_PUBLIC_APP_URL` | Your app's URL | Your Vercel deployment |

### Optional Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | OpenAI API key | OpenAI Platform |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL | Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | Upstash Console |

### Convex Environment Variables

Set these directly in Convex (not Vercel):

| Variable | Description |
|----------|-------------|
| `CERTIFICATE_SIGNING_SECRET` | Secret for signing certificates |
| `SITE_URL` | Production site URL |

---

## 🎉 Deployment Complete!

Your ECAST Academy is now live on Vercel! 

### Next Steps

1. **Create Content**: Log in as admin and create your first course
2. **Invite Users**: Share your app URL with learners
3. **Monitor**: Use Vercel Analytics and Convex Dashboard for monitoring
4. **Iterate**: Deploy updates by pushing to your main branch

### Useful Links

- [Vercel Dashboard](https://vercel.com/dashboard) - Monitor deployments
- [Convex Dashboard](https://dashboard.convex.dev) - Backend management
- [Clerk Dashboard](https://dashboard.clerk.com) - User management
- [Vercel Analytics](https://vercel.com/analytics) - Performance monitoring

---

<div align="center">

**Need Help?**

Open an issue on [GitHub](https://github.com/Avinash1286/ecastacademy/issues) or check the [README](./README.md) for more information.

</div>
