# ShiftSwap Deployment Guide

This guide walks through deploying ShiftSwap on **Vercel** with **Supabase** for auth and **Neon** for Postgres.

## Prerequisites

- [Vercel](https://vercel.com) account
- [Supabase](https://supabase.com) account
- [Neon](https://neon.tech) account (or use Supabase's hosted Postgres)
- Git repository connected to Vercel

## 1. Provision Supabase Project

1. Create a new Supabase project at [app.supabase.com](https://app.supabase.com).
2. Note the following from **Project Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL` — your project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon` / `public` key
3. Run the SQL migrations in **SQL Editor**:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_org_context.sql`
4. Under **Authentication > URL Configuration**, set the Site URL to your Vercel production domain (e.g., `https://shiftswap.vercel.app`).
5. Add redirect URLs:
   - `https://shiftswap.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)

## 2. Provision Neon Database

1. Create a new Neon project at [console.neon.tech](https://console.neon.tech).
2. Copy the connection string — this is your `DATABASE_URL`.
3. Run the same migrations against Neon if using it as primary DB:
   ```bash
   psql $DATABASE_URL < supabase/migrations/001_initial_schema.sql
   psql $DATABASE_URL < supabase/migrations/002_org_context.sql
   ```

> **Note:** If you prefer Supabase's built-in Postgres, skip Neon and use the Supabase connection string as `DATABASE_URL`.

## 3. Deploy to Vercel

### Option A: Vercel Dashboard

1. Import the Git repository in [Vercel](https://vercel.com/new).
2. Vercel auto-detects **Next.js** — accept the defaults.
3. Add environment variables (Settings > Environment Variables):

   | Variable                        | Value                          | Environments    |
   | ------------------------------- | ------------------------------ | --------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxx.supabase.co`      | All             |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...`                       | All             |
   | `DATABASE_URL`                  | `postgresql://...`             | All             |
   | `NEXT_PUBLIC_SITE_URL`          | `https://shiftswap.vercel.app` | Production      |
   | `NEXT_PUBLIC_SITE_URL`          | `http://localhost:3000`        | Development     |

4. Click **Deploy**.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_SITE_URL
vercel --prod
```

## 4. Post-Deployment Checklist

- [ ] Visit the production URL and verify the landing page loads
- [ ] Create a test account via signup
- [ ] Confirm email verification works (check Supabase Auth logs)
- [ ] Log in and verify dashboard renders
- [ ] Check browser console for errors
- [ ] Verify security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.)

## 5. Local Development

```bash
# 1. Clone the repository
git clone <repo-url> && cd shiftswap

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Neon credentials

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 6. Environment Variables Reference

| Variable                        | Required | Description                                    |
| ------------------------------- | -------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Supabase project URL                           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Supabase anonymous/public API key              |
| `DATABASE_URL`                  | Yes      | Neon (or Supabase) Postgres connection string  |
| `NEXT_PUBLIC_SITE_URL`          | Yes      | App URL for auth redirects                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | No       | Supabase service role key (admin operations)   |

## Troubleshooting

**Build fails with missing env vars:**
Ensure all `NEXT_PUBLIC_*` variables are set for all environments in Vercel.

**Auth redirects to wrong URL:**
Update the Site URL and redirect URLs in Supabase Auth settings.

**Database connection errors:**
Verify `DATABASE_URL` includes `?sslmode=require` for Neon connections.

**RLS blocks all queries:**
Ensure the `set_org_context` RPC function exists and `app.current_org_id` is set before org-scoped queries.
