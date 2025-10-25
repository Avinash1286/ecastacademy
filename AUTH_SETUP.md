# Authentication Setup Guide

This guide will help you set up authentication for ECAST Academy.

## Prerequisites

1. Convex account and deployment URL
2. Google OAuth credentials (optional, for Google login)
3. GitHub OAuth credentials (optional, for GitHub login)
4. Email service credentials (optional, for password reset)

## Step 1: Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Convex (Already configured)
NEXT_PUBLIC_CONVEX_URL=your_convex_deployment_url

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<generate using: openssl rand -base64 32>

# Google OAuth (Get from https://console.cloud.google.com/)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth (Get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Email Configuration (for password reset)
# For Gmail, use an App Password: https://support.google.com/accounts/answer/185833
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your_email@gmail.com
EMAIL_SERVER_PASSWORD=your_app_password
EMAIL_FROM=noreply@ecastacademy.com
```

## Step 2: Generate NextAuth Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `NEXTAUTH_SECRET` in `.env.local`.

## Step 3: Set Up Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Set application type to "Web application"
6. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Copy the Client ID and Client Secret to your `.env.local`

## Step 4: Set Up GitHub OAuth (Optional)

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the details:
   - Application name: ECAST Academy
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Generate a new client secret
6. Copy the Client ID and Client Secret to your `.env.local`

## Step 5: Set Up Email Service (Optional)

### Using Gmail:

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device
   - Copy the generated password
3. Use these settings in `.env.local`:
   ```env
   EMAIL_SERVER_HOST=smtp.gmail.com
   EMAIL_SERVER_PORT=587
   EMAIL_SERVER_USER=your_email@gmail.com
   EMAIL_SERVER_PASSWORD=your_app_password
   EMAIL_FROM=noreply@yourdomain.com
   ```

### Using Other Email Services:

- **SendGrid**: Use SMTP relay with your API key
- **Mailgun**: Use SMTP credentials from your account
- **AWS SES**: Use SMTP credentials from IAM

## Step 6: Deploy Schema to Convex

The schema has been updated with authentication tables. Deploy it to Convex:

```bash
npx convex dev
```

This will create the following tables:
- `users` - User accounts
- `accounts` - OAuth account linking
- `sessions` - User sessions
- `verificationTokens` - Password reset tokens

## Step 7: Create First Admin User

After deploying the schema:

1. Sign up for an account through the UI at `/auth/signup`
2. Go to your Convex dashboard
3. Navigate to the `users` table
4. Find your user and change the `role` field from `"user"` to `"admin"`
5. Save the changes

You now have admin access and can promote other users!

## Step 8: Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the new landing page with authentication.

## Production Deployment

When deploying to production:

1. Update `NEXTAUTH_URL` to your production domain
2. Add production callback URLs to Google and GitHub OAuth apps
3. Ensure all environment variables are set in your hosting platform
4. Deploy your Convex functions to production

## Features Included

✅ Email/password authentication with secure password hashing
✅ Google OAuth login
✅ GitHub OAuth login
✅ Password reset via email
✅ Role-based access control (Admin/User)
✅ Protected routes with middleware
✅ Admin user management panel
✅ Session management with JWT
✅ Beautiful auth UI pages

## Troubleshooting

### OAuth not working

- Check that callback URLs are correctly configured
- Ensure client ID and secret are correct
- Verify environment variables are loaded

### Email not sending

- Check SMTP credentials
- For Gmail, ensure App Password is used (not regular password)
- Check spam folder for test emails

### Admin access denied

- Verify your user's role is set to "admin" in Convex database
- Clear browser cookies and sign in again

## Security Notes

- Never commit `.env.local` to version control
- Use strong, unique passwords for email/password auth
- Rotate OAuth secrets periodically
- Use HTTPS in production
- Enable CORS properly for your domain

## Support

If you encounter any issues, please check:
- Convex dashboard for backend errors
- Browser console for frontend errors
- Server logs for API route errors

