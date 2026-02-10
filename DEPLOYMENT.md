# ShiftSwap Deployment Guide

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project (free tier works)
- A [Vercel](https://vercel.com/) account (free tier works)
- Git repository pushed to GitHub

## 1. Supabase Setup

### Create a Project

1. Go to [supabase.com](https://supabase.com/) and create a new project
2. Choose a region close to your users
3. Set a strong database password and save it

### Run the Database Migration

1. Go to **SQL Editor** in the Supabase dashboard
2. Paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run** to create tables, indexes, RLS policies, and triggers

### Get API Keys

1. Go to **Settings → API**
2. Copy the **Project URL** (this is `NEXT_PUBLIC_SUPABASE_URL`)
3. Copy the **anon/public key** (this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### Configure Auth

1. Go to **Authentication → Settings**
2. Set the **Site URL** to your production domain (e.g., `https://your-app.vercel.app`)
3. Add redirect URLs:
   - `https://your-app.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)

## 2. Vercel Deployment

### Connect Repository

1. Go to [vercel.com](https://vercel.com/) and click **Add New → Project**
2. Import your GitHub repository
3. Vercel will auto-detect Next.js

### Set Environment Variables

In Vercel project settings (**Settings → Environment Variables**), add:

| Variable | Value | Environments |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key | Production, Preview, Development |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | Production |

### Deploy

1. Click **Deploy** — Vercel will build and deploy automatically
2. Subsequent pushes to `main` will trigger automatic deployments
3. Pull requests get automatic preview deployments

## 3. Local Development

```bash
# Clone the repo
git clone <your-repo-url>
cd shiftswap

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 5. Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public API key |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your app's URL (for auth redirects) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Service role key for admin operations |

## 6. Troubleshooting

### Build fails on Vercel

- Verify all required environment variables are set
- Check that the Supabase URL and key are correct
- Ensure Node.js version is 18+

### Auth redirects not working

- Verify `NEXT_PUBLIC_SITE_URL` matches your deployed domain
- Check Supabase Auth settings → Redirect URLs includes your domain
- Ensure the `/auth/callback` route is accessible

### Database queries failing

- Confirm the migration SQL has been run in Supabase SQL Editor
- Check RLS policies are enabled and correct
- Verify the anon key has the correct permissions
