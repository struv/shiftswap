# ShiftSwap Deployment Guide

This guide walks through deploying ShiftSwap on **Vercel** with **Neon Auth** for authentication and **Neon Postgres** for the database.

## Prerequisites

- [Vercel](https://vercel.com) account
- [Neon](https://neon.tech) account (provides both Auth and Postgres)
- Git repository connected to Vercel

## 1. Provision Neon Project

1. Create a new Neon project at [console.neon.tech](https://console.neon.tech).
2. Copy the connection string — this is your `DATABASE_URL`.
3. Enable **Neon Auth** in the project settings and note the `NEON_AUTH_BASE_URL`.
4. Run the database migrations:
   ```bash
   npx drizzle-kit migrate
   ```

## 2. Deploy to Vercel

### Option A: Vercel Dashboard

1. Import the Git repository in [Vercel](https://vercel.com/new).
2. Vercel auto-detects **Next.js** — accept the defaults.
3. Add environment variables (Settings > Environment Variables):

   | Variable                | Value                          | Environments    |
   | ----------------------- | ------------------------------ | --------------- |
   | `NEON_AUTH_BASE_URL`    | `https://your-auth.neon.tech`  | All             |
   | `DATABASE_URL`          | `postgresql://...`             | All             |
   | `NEXT_PUBLIC_SITE_URL`  | `https://shiftswap.vercel.app` | Production      |
   | `NEXT_PUBLIC_SITE_URL`  | `http://localhost:3000`        | Development     |

4. Click **Deploy**.

### Option B: Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link
vercel env add NEON_AUTH_BASE_URL
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_SITE_URL
vercel --prod
```

## 3. Post-Deployment Checklist

- [ ] Visit the production URL and verify the landing page loads
- [ ] Create a test account via signup
- [ ] Log in and verify dashboard renders
- [ ] Check browser console for errors
- [ ] Verify security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.)

## 4. Local Development

```bash
# 1. Clone the repository
git clone <repo-url> && cd shiftswap

# 2. Install dependencies
npm install

# 3. Copy environment variables
cp .env.example .env.local
# Edit .env.local with your Neon Auth and Postgres credentials

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Environment Variables Reference

| Variable               | Required | Description                                    |
| ---------------------- | -------- | ---------------------------------------------- |
| `NEON_AUTH_BASE_URL`   | Yes      | Neon Auth service endpoint                     |
| `DATABASE_URL`         | Yes      | Neon Postgres connection string                |
| `NEXT_PUBLIC_SITE_URL` | Yes      | App URL for redirects                          |

## Troubleshooting

**Build fails with missing env vars:**
Ensure `NEON_AUTH_BASE_URL` and `DATABASE_URL` are set for all environments in Vercel.

**Auth not working:**
Verify `NEON_AUTH_BASE_URL` is correct and the Neon Auth service is enabled for your project.

**Database connection errors:**
Verify `DATABASE_URL` includes `?sslmode=require` for Neon connections.

**RLS blocks all queries:**
Ensure the `set_org_context` RPC function exists and `app.current_org_id` is set before org-scoped queries.
