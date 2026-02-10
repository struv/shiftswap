# ShiftSwap MVP Scope

**Status:** FROZEN
**Date:** February 10, 2026
**Version:** 1.0

This document locks down the MVP features, roles, authentication strategy, and tech stack for ShiftSwap. No scope changes without explicit approval.

---

## MVP Features (Frozen)

### In Scope

**Shift Management**
- Create, view, edit, and delete shifts
- Weekly calendar view (per-location and per-user)
- Bulk shift creation via CSV import (migrate from When I Work)
- Shift templates for recurring weekly schedules

**Shift Swap Workflow**
- Staff post call-outs (can't work a scheduled shift)
- Staff claim open shifts
- Manager one-click approval/denial
- Email notifications for swap requests, approvals, and denials
- In-app notification bell with unread count

**User & Location Management**
- Admin creates and manages users
- Admin creates and manages locations
- Users assigned to one or more locations
- Role-based access control (see Roles below)

**Multi-Tenancy**
- Organization-scoped data isolation
- Row-Level Security (RLS) on all tables

### Out of Scope (NOT in MVP)

- Time-off / PTO requests
- Advanced scheduling or auto-fill algorithms
- SMS notifications (Twilio) -- deferred to Week 2+
- Payroll integration
- Time clock (clock in/out)
- Labor law compliance checks
- Mobile native app (PWA may follow later)
- Billing / Stripe integration (manual invoicing for now)
- Advanced reporting / analytics

---

## Roles

Three roles, enforced via RBAC at the API layer and RLS at the database layer:

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **admin** | Organization owner | All permissions. Manage org settings, locations, all users across all locations, view audit logs. |
| **manager** | Location manager | View full location schedule. Approve/deny swap requests. Create/edit shifts. Manage staff at assigned locations. Apply shift templates. |
| **staff** | Employee | View own schedule. Post call-outs on own shifts. Claim open shifts. View notifications. |

---

## Auth Decision

**Choice: Supabase Auth**

| Considered | Decision | Rationale |
|------------|----------|-----------|
| Supabase Auth | **Selected** | Already integrated in codebase. Handles signup, login, password reset, session management. RLS policies tie directly to `auth.uid()`. No additional service to manage. |
| Clerk | Rejected | Adds external dependency and cost. Supabase Auth covers all MVP needs. |
| Custom JWT | Rejected | Unnecessary build effort when Supabase Auth provides the same functionality out of the box. |

**Session management:** Supabase handles tokens via httpOnly cookies (SSR-compatible with `@supabase/ssr`).

---

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Framework** | Next.js 15 (App Router) | Server components, server actions, middleware for auth |
| **Language** | TypeScript | Strict mode |
| **UI** | React 19 + Tailwind CSS | shadcn/ui components as needed |
| **Database** | Neon Postgres | Serverless Postgres, branching for preview deploys |
| **ORM** | Drizzle | Type-safe schema, migrations, query builder |
| **API** | tRPC | Type-safe client-server communication |
| **Auth** | Supabase Auth | Email/password, session management, RLS integration |
| **Hosting** | Vercel | Edge-optimized, automatic preview deploys |
| **Email** | Resend (SMTP) | Transactional emails for swap notifications |

### Current State vs Target

The codebase currently uses Supabase for both auth and database. The target architecture migrates the database layer to Neon Postgres + Drizzle for better control over schema migrations and type safety, while retaining Supabase Auth for authentication. tRPC will be added for type-safe API routes.

---

## Decision Log

| # | Decision | Date | Rationale |
|---|----------|------|-----------|
| 1 | Freeze MVP to shifts + swaps only | 2026-02-10 | Ship fast; time-off and advanced scheduling deferred |
| 2 | Three roles: admin / manager / staff | 2026-02-10 | Matches real-world org structure (owner, location leads, employees) |
| 3 | Supabase Auth over Clerk | 2026-02-10 | Already integrated, no extra cost, RLS-native |
| 4 | Next.js App Router + Neon + Drizzle + tRPC | 2026-02-10 | Type-safe full stack; Neon for serverless Postgres; Drizzle for migrations |
| 5 | Vercel for hosting | 2026-02-10 | Zero-config Next.js deploys, edge functions, preview URLs |
| 6 | No SMS in MVP | 2026-02-10 | Email sufficient for launch; Twilio adds complexity |
| 7 | No billing in MVP | 2026-02-10 | Manual invoicing until external customers onboard |
