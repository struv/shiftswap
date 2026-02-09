# ShiftSwap - Complete Technical Specification

**Version:** 1.0  
**Date:** February 9, 2026  
**Timeline:** 1 week to production (replace When I Work)  
**Build Method:** SGT overnight automation

---

## Executive Summary

ShiftSwap is a multi-tenant shift scheduling and swap management system for medical practices and multi-location businesses. Core workflow: employees request same-day shift swaps → managers approve via one-click → notifications sent automatically.

**Primary Use Case:** Replace When I Work at [Company Name] (23 clinic locations, $800/month savings).

**Key Differentiators:**
- Same-day swap workflow (critical for medical emergencies)
- Multi-location support (23 clinics in single org)
- CSV import (migrate from When I Work)
- Manager approval via email link (no login required)

---

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- Tailwind CSS 4
- shadcn/ui components
- Vite build system

**Backend:**
- Node.js + Express 4
- tRPC 11 (type-safe API)
- PostgreSQL 15+
- Drizzle ORM
- JWT authentication (no external auth providers)

**Infrastructure:**
- Frontend: Vercel
- Backend: Railway
- Database: Railway PostgreSQL or Supabase
- Email: SMTP (Resend/SendGrid)
- SMS: Twilio

**Deployment Target:** Railway + Vercel (1-click deploy)

---

## Database Schema

### Multi-Tenancy Model

**Row-Level Security (RLS) Pattern:**
- Every table has `org_id` foreign key
- PostgreSQL RLS policies enforce isolation
- Application sets `app.current_org_id` session variable
- All queries automatically scoped to current org

**Schema Overview:**

```sql
-- Core multi-tenancy
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier
  settings JSONB DEFAULT '{}', -- org-specific config
  plan TEXT NOT NULL DEFAULT 'free', -- free, starter, pro, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, suspended, canceled
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations within org (e.g., 23 clinics)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (employees + managers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'employee', -- employee, manager, admin
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, email)
);

-- User location assignments (employees can work at multiple locations)
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false, -- home location
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

-- Shifts
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  role TEXT, -- optional: nurse, doctor, receptionist, etc.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shift templates (recurring weekly schedules)
CREATE TABLE shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Week 1 Schedule", "Summer Hours", etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template shift definitions
CREATE TABLE template_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES shift_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT,
  notes TEXT
);

-- Swap requests
CREATE TABLE swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  original_shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- can be null if "anyone can cover"
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, canceled
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-off requests
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, canceled
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- swap_request, swap_approved, swap_denied, time_off_approved, etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  link TEXT, -- deep link to relevant page
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- shift_created, swap_approved, etc.
  entity_type TEXT NOT NULL, -- shift, swap_request, user, etc.
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shifts_org_location ON shifts(org_id, location_id);
CREATE INDEX idx_shifts_user_time ON shifts(user_id, start_time);
CREATE INDEX idx_swap_requests_org_status ON swap_requests(org_id, status);
CREATE INDEX idx_time_off_org_status ON time_off_requests(org_id, status);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- Row-Level Security (RLS) Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (repeat for all tables)
CREATE POLICY org_isolation ON organizations
  USING (id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation ON shifts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- etc. for all tables
```

---

## API Routes (tRPC)

### Authentication

```typescript
// auth.login
input: { email: string, password: string }
output: { token: string, user: User }

// auth.register (admin creates users)
input: { orgId: string, email: string, password: string, firstName: string, lastName: string, role: string }
output: { user: User }

// auth.me (get current user)
output: { user: User }

// auth.logout
output: { success: boolean }
```

### Organizations

```typescript
// org.create
input: { name: string, slug: string }
output: { org: Organization }

// org.get
output: { org: Organization }

// org.update
input: { name?: string, settings?: object }
output: { org: Organization }
```

### Locations

```typescript
// location.list
output: { locations: Location[] }

// location.create
input: { name: string, address?: string, timezone: string }
output: { location: Location }

// location.update
input: { id: string, name?: string, address?: string }
output: { location: Location }

// location.delete
input: { id: string }
output: { success: boolean }
```

### Users

```typescript
// user.list
input: { locationId?: string, role?: string }
output: { users: User[] }

// user.create
input: { email: string, password: string, firstName: string, lastName: string, role: string, locationIds: string[] }
output: { user: User }

// user.update
input: { id: string, firstName?: string, lastName?: string, role?: string, phone?: string }
output: { user: User }

// user.assignLocations
input: { userId: string, locationIds: string[] }
output: { success: boolean }
```

### Shifts

```typescript
// shift.list
input: { locationId?: string, startDate: string, endDate: string, userId?: string }
output: { shifts: Shift[] }

// shift.create
input: { locationId: string, userId: string, startTime: string, endTime: string, role?: string, notes?: string }
output: { shift: Shift }

// shift.update
input: { id: string, userId?: string, startTime?: string, endTime?: string }
output: { shift: Shift }

// shift.delete
input: { id: string }
output: { success: boolean }

// shift.bulkCreate (CSV import)
input: { shifts: Array<{ locationId, userId, startTime, endTime, role? }> }
output: { created: number, errors: Array<{ row, error }> }
```

### Shift Templates

```typescript
// template.list
output: { templates: ShiftTemplate[] }

// template.create
input: { locationId: string, name: string }
output: { template: ShiftTemplate }

// template.addShifts
input: { templateId: string, shifts: Array<{ dayOfWeek, startTime, endTime, role? }> }
output: { success: boolean }

// template.applyToWeek
input: { templateId: string, startDate: string }
output: { shiftsCreated: number }
```

### Swap Requests

```typescript
// swap.list
input: { status?: string, locationId?: string }
output: { swaps: SwapRequest[] }

// swap.create
input: { shiftId: string, replacementUserId?: string, reason?: string }
output: { swap: SwapRequest }

// swap.approve
input: { id: string, managerNotes?: string }
output: { swap: SwapRequest }

// swap.deny
input: { id: string, managerNotes?: string }
output: { swap: SwapRequest }

// swap.cancel
input: { id: string }
output: { swap: SwapRequest }
```

### Time-Off Requests

```typescript
// timeOff.list
input: { status?: string, userId?: string }
output: { requests: TimeOffRequest[] }

// timeOff.create
input: { startDate: string, endDate: string, reason?: string }
output: { request: TimeOffRequest }

// timeOff.approve
input: { id: string, managerNotes?: string }
output: { request: TimeOffRequest }

// timeOff.deny
input: { id: string, managerNotes?: string }
output: { request: TimeOffRequest }
```

### Notifications

```typescript
// notification.list
input: { unreadOnly?: boolean }
output: { notifications: Notification[] }

// notification.markRead
input: { id: string }
output: { success: boolean }

// notification.markAllRead
output: { success: boolean }
```

---

## UI Components & Pages

### Layout Structure

```
/
├── /login
├── /dashboard (redirect based on role)
│   ├── /employee
│   │   ├── /schedule (weekly calendar view)
│   │   ├── /my-shifts (list view)
│   │   ├── /request-swap (form)
│   │   ├── /time-off (request + history)
│   │   └── /notifications
│   └── /manager
│       ├── /schedule (location-wide calendar)
│       ├── /pending-swaps (approval queue)
│       ├── /pending-time-off
│       ├── /employees (manage users)
│       └── /templates (shift templates)
└── /admin
    ├── /organizations
    ├── /locations
    ├── /users
    └── /settings
```

### Core Components

**1. WeeklyCalendar.tsx**
- 7-column grid (Sun-Sat)
- Time slots (6am-12am)
- Shift cards with employee name, role, time
- Click shift → view details / request swap
- Drag-and-drop (future enhancement)

**2. ShiftCard.tsx**
- Employee name
- Time range
- Role badge
- Status indicator (normal, swap-requested, covered)
- Click → open ShiftDetailsModal

**3. SwapRequestModal.tsx**
- Show shift details
- Select replacement employee (dropdown of available staff)
- Reason field (optional)
- Submit button
- Confirmation toast

**4. ManagerApprovalQueue.tsx**
- List of pending swap requests
- Each row: requester, shift, replacement, reason, timestamp
- Approve/Deny buttons (one-click)
- Manager notes field (optional)

**5. NotificationDropdown.tsx**
- Bell icon with unread count badge
- Dropdown list of recent notifications
- Click notification → navigate to relevant page
- Mark all read button

**6. CSVImportModal.tsx**
- File upload dropzone
- Preview table (first 5 rows)
- Column mapping (map CSV columns to shift fields)
- Validate button → show errors
- Import button → bulk create shifts

---

## Core Workflows

### Workflow 1: Employee Requests Shift Swap

**Scenario:** Employee can't work scheduled shift (sick, emergency).

**Steps:**
1. Employee logs in → views "My Schedule"
2. Clicks shift → "Request Swap" button
3. Modal opens:
   - Shows shift details (date, time, location)
   - Dropdown: Select replacement employee (filtered: available + same location)
   - Optional: Add reason
4. Employee submits request
5. Backend:
   - Creates `swap_request` record (status: pending)
   - Sends email to manager(s) at that location
   - Sends SMS to manager(s) (if configured)
   - Creates notification for manager
   - Creates notification for replacement employee (if selected)
6. Success toast: "Swap request submitted. Manager will review."

**Email Template (Manager):**
```
Subject: Shift Swap Request - [Employee Name]

[Employee Name] has requested a shift swap:

Shift: [Date] [Start Time] - [End Time]
Location: [Location Name]
Replacement: [Replacement Name] (or "Anyone available")
Reason: [Reason or "Not provided"]

[Approve Button] [Deny Button]

Or review in ShiftSwap: [Link to pending swaps page]
```

**Email Button Links:**
- Approve: `https://shiftswap.app/api/swap/approve/{id}?token={manager_token}`
- Deny: `https://shiftswap.app/api/swap/deny/{id}?token={manager_token}`

### Workflow 2: Manager Approves Swap

**Scenario:** Manager receives swap request, approves it.

**Steps:**
1. Manager clicks "Approve" in email (no login required)
   - OR logs in → "Pending Swaps" page → clicks Approve
2. Backend:
   - Updates `swap_request.status = 'approved'`
   - Updates `shifts.user_id` to replacement employee
   - Sends email to original employee: "Your swap was approved"
   - Sends email to replacement employee: "You're now scheduled for [shift]"
   - Sends SMS to both (if configured)
   - Creates notifications for both
   - Logs audit entry
3. Calendar updates automatically (replacement employee now shown on shift)

### Workflow 3: Manager Denies Swap

**Steps:**
1. Manager clicks "Deny" in email
2. Modal opens: "Add notes (optional)"
3. Manager submits
4. Backend:
   - Updates `swap_request.status = 'denied'`
   - Sends email to original employee: "Your swap was denied. [Manager notes]"
   - Creates notification
5. Original employee remains on shift

### Workflow 4: Employee Requests Time Off

**Steps:**
1. Employee logs in → "Time Off" page
2. Fills form:
   - Start date
   - End date
   - Reason (optional)
3. Submits
4. Backend:
   - Creates `time_off_request` (status: pending)
   - Sends email to manager
   - Creates notification
5. Manager reviews (same approve/deny flow as swaps)
6. If approved:
   - Blocks those dates (no shifts can be scheduled)
   - OR removes employee from any existing shifts in that range

### Workflow 5: Admin Applies Shift Template

**Scenario:** Manager wants to schedule next week using recurring template.

**Steps:**
1. Manager → "Templates" page
2. Selects template ("Week 1 Schedule")
3. Clicks "Apply to Week"
4. Selects start date (e.g., Feb 10)
5. Backend:
   - Reads template shifts
   - Creates shifts for that week (Mon-Sun)
   - Uses template's day_of_week + time
   - Assigns to users based on role (or leaves unassigned if template doesn't specify user)
6. Success: "30 shifts created for week of Feb 10"

### Workflow 6: CSV Import Schedule

**Scenario:** Migrating from When I Work.

**Steps:**
1. Admin exports CSV from When I Work:
   ```csv
   Employee Email,Location,Start Time,End Time,Role
   john@example.com,Main Clinic,2026-02-10 09:00,2026-02-10 17:00,Nurse
   jane@example.com,East Clinic,2026-02-10 08:00,2026-02-10 16:00,Doctor
   ```
2. Admin → "Import Schedule" page
3. Uploads CSV
4. Maps columns:
   - Employee Email → user_id (backend looks up by email)
   - Location → location_id (backend looks up by name)
   - Start Time → start_time
   - End Time → end_time
   - Role → role
5. Preview shows first 5 rows
6. Clicks "Validate" → backend checks:
   - All employees exist
   - All locations exist
   - No overlapping shifts
7. If valid: "Import" button enabled
8. Clicks "Import"
9. Backend bulk creates shifts
10. Success: "150 shifts imported. 3 errors (see log)."

---

## Authentication & Authorization

### JWT Token Structure

```typescript
interface JWTPayload {
  userId: string;
  orgId: string;
  role: 'employee' | 'manager' | 'admin';
  email: string;
  exp: number; // expiration timestamp
}
```

### Role-Based Access Control (RBAC)

**Employee:**
- View own schedule
- Request swaps on own shifts
- Request time off
- View notifications

**Manager:**
- All employee permissions
- View full location schedule
- Approve/deny swaps
- Approve/deny time off
- Manage employees at assigned locations
- Create/edit shifts
- Apply templates

**Admin:**
- All manager permissions
- Manage organization settings
- Create/edit locations
- Manage all users across all locations
- View audit logs
- Billing/subscription management

### Session Management

- JWT stored in httpOnly cookie (not localStorage - XSS protection)
- Token expires after 7 days
- Refresh token flow (future enhancement)
- Logout clears cookie

---

## Notification System

### Email Notifications (via SMTP)

**Provider:** Resend or SendGrid

**Templates:**
1. Swap request submitted (to manager)
2. Swap approved (to both employees)
3. Swap denied (to requester)
4. Time off approved (to employee)
5. Time off denied (to employee)
6. Shift reminder (24 hours before shift)
7. Schedule published (weekly summary)

**Email Features:**
- One-click approve/deny buttons (manager emails)
- Deep links to app
- Plain text + HTML versions
- Unsubscribe link (per notification type)

### SMS Notifications (via Twilio)

**When to send SMS:**
- Same-day swap requests (urgent)
- Approved swaps (both employees need immediate confirmation)
- Shift reminders (1 hour before shift)

**SMS Template Example:**
```
ShiftSwap: [Employee] requested swap for your shift today at [Time]. Approve: [Link]
```

### In-App Notifications

- Bell icon with unread count
- Dropdown list (last 10 notifications)
- Click notification → navigate to relevant page
- Mark as read
- Persist in database (not lost on logout)

---

## Multi-Tenancy Implementation Guide

### Setting Current Organization Context

**Backend middleware:**
```typescript
// middleware/setOrgContext.ts
export const setOrgContext = async (req, res, next) => {
  const token = req.cookies.auth_token;
  const decoded = verifyJWT(token);
  
  // Set PostgreSQL session variable
  await db.query(
    "SELECT set_config('app.current_org_id', $1, false)",
    [decoded.orgId]
  );
  
  req.user = decoded;
  next();
};
```

**All tRPC routes use this middleware** → automatic org scoping.

### Organization Signup Flow

**For new customer:**
1. Admin fills signup form:
   - Organization name
   - Admin email + password
   - Billing plan
2. Backend:
   - Creates `organization` record
   - Creates `users` record (role: admin)
   - Sends welcome email with setup link
3. Admin logs in:
   - Setup wizard:
     - Add locations
     - Invite employees (email invites)
     - Upload CSV schedule (optional)
   - Dashboard tour

**For William's company:**
- Manual seed script:
  - Create org: "Pediatric Medical Group"
  - Create 23 locations
  - Create users (import from When I Work CSV)
  - Import shifts (CSV)
- Deliver credentials to admin

### Data Isolation Validation

**Tests to write:**
1. User from Org A cannot see users from Org B
2. Shifts from Org A not visible to Org B
3. Swap requests isolated
4. API calls with wrong orgId in JWT → 403 Forbidden
5. SQL injection attempts with org_id → blocked by RLS

---

## CSV Import Specification

### Expected CSV Format

**Minimal:**
```csv
Employee Email,Location,Start Time,End Time
john@example.com,Main Clinic,2026-02-10T09:00:00-08:00,2026-02-10T17:00:00-08:00
```

**Full:**
```csv
Employee Email,First Name,Last Name,Location,Start Time,End Time,Role,Notes
john@example.com,John,Doe,Main Clinic,2026-02-10T09:00:00-08:00,2026-02-10T17:00:00-08:00,Nurse,Cover for Jane
```

### Import Logic

**Phase 1: Validation**
1. Check headers (required columns present)
2. Parse dates (ISO 8601 or common formats)
3. Lookup users by email (error if not found)
4. Lookup locations by name (error if not found)
5. Check for overlapping shifts (warn, don't block)

**Phase 2: Import**
1. Bulk insert shifts (batch of 100 at a time)
2. Track errors per row
3. Return summary: { imported: 150, failed: 3, errors: [...] }

**Error Handling:**
- Row-level errors logged
- Partial success allowed (import what's valid, skip invalid rows)
- Downloadable error report CSV

---

## Deployment Guide

### Railway Backend Deployment

**Prerequisites:**
- Railway account
- GitHub repo connected

**Steps:**
1. Create new Railway project
2. Add PostgreSQL service
3. Add Node.js service (backend)
4. Environment variables:
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=random_256_bit_string
   SMTP_HOST=smtp.resend.com
   SMTP_USER=resend_api_key
   SMTP_FROM=noreply@shiftswap.app
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE=+1...
   ```
5. Deploy via GitHub push (automatic)

### Vercel Frontend Deployment

**Steps:**
1. Create new Vercel project
2. Connect GitHub repo
3. Root directory: `client/`
4. Build command: `npm run build`
5. Environment variable:
   ```
   VITE_API_URL=https://shiftswap-backend.railway.app
   ```
6. Deploy

### Post-Deployment Checklist

- [ ] Run database migrations
- [ ] Seed test org + users
- [ ] Test login flow
- [ ] Test shift creation
- [ ] Test swap request flow
- [ ] Test email delivery (send test emails)
- [ ] Test SMS delivery (send test SMS)
- [ ] Load test (100 concurrent users)
- [ ] Security audit (OWASP top 10)
- [ ] HTTPS enabled (auto via Railway/Vercel)
- [ ] CORS configured (frontend → backend)
- [ ] Rate limiting enabled (prevent abuse)

---

## SGT Overnight Build Plan

### Molecule Definition

**File:** `shiftswap-mvp.yml`

```yaml
name: shiftswap-mvp
description: Build ShiftSwap MVP with multi-tenancy, swap workflow, and CSV import
steps:
  # Phase 1: Foundation
  - task: "Set up repo structure: client/, server/, shared/, drizzle/. Initialize package.json, tsconfig.json, vite.config.ts, drizzle.config.ts. Install dependencies: react, express, trpc, drizzle, tailwind, shadcn/ui."
    type: dog
    label: repo-setup
    
  - task: "Implement database schema per spec: organizations, locations, users, user_locations, shifts, shift_templates, template_shifts, swap_requests, time_off_requests, notifications, audit_logs. Enable RLS with org isolation policies. Write Drizzle schema + migrations."
    type: polecat
    depends_on: [0]
    label: database-schema
    
  - task: "Build JWT authentication system: register, login, logout, token validation middleware. Implement setOrgContext middleware (sets app.current_org_id session variable). Write auth.ts router."
    type: polecat
    depends_on: [1]
    label: auth-system
    
  # Phase 2: Core Features (parallel)
  - task: "Build organization & location management: tRPC routers for org.create, org.get, location.list, location.create, location.update, location.delete. Implement RBAC checks (admin-only)."
    type: polecat
    depends_on: [2]
    label: org-location-api
    
  - task: "Build user management: tRPC routers for user.list, user.create, user.update, user.assignLocations. Support filtering by location and role. Implement password hashing (bcrypt)."
    type: polecat
    depends_on: [2]
    label: user-api
    
  - task: "Build shift CRUD API: shift.list (date range + location filter), shift.create, shift.update, shift.delete, shift.bulkCreate (CSV import). Validate no overlapping shifts per user."
    type: polecat
    depends_on: [1]
    label: shift-api
    
  - task: "Build shift template system: template.list, template.create, template.addShifts, template.applyToWeek. Logic: read template shifts, generate actual shifts for specified week."
    type: polecat
    depends_on: [5]
    label: template-api
    
  # Phase 3: Swap & Time-Off Workflow
  - task: "Build swap request workflow: swap.list, swap.create, swap.approve, swap.deny, swap.cancel. On approval: update shift.user_id to replacement. Trigger notifications (in-app + email/SMS)."
    type: polecat
    depends_on: [5]
    label: swap-workflow
    
  - task: "Build time-off request workflow: timeOff.list, timeOff.create, timeOff.approve, timeOff.deny. On approval: block dates or remove shifts in range."
    type: polecat
    depends_on: [5]
    label: time-off-workflow
    
  - task: "Implement notification system: notification.list, notification.markRead, notification.markAllRead. Write email templates (swap request, approval, denial). Integrate SMTP (Resend) and Twilio SMS. Support one-click approve/deny links in emails."
    type: polecat
    depends_on: [7]
    label: notification-system
    
  # Phase 4: Frontend (parallel with backend)
  - task: "Build layout & navigation: AppLayout.tsx with sidebar, header, user menu. Routes for /login, /dashboard, /schedule, /pending-swaps, /time-off, /employees, /templates. Implement RoleGuard component (employee/manager/admin)."
    type: polecat
    depends_on: [2]
    label: layout-nav
    
  - task: "Build WeeklyCalendar component: 7-column grid (Sun-Sat), time slots (6am-12am), ShiftCard components. Click shift → open ShiftDetailsModal. Color-code by role. Show swap-requested status indicator."
    type: polecat
    depends_on: [10]
    label: calendar-ui
    
  - task: "Build employee dashboard: My Schedule page (weekly calendar filtered to current user), Request Swap modal (select replacement, add reason), My Time Off page (request form + history table)."
    type: polecat
    depends_on: [11]
    label: employee-dashboard
    
  - task: "Build manager dashboard: Pending Swaps page (approval queue with one-click buttons), Pending Time Off page, Location Schedule page (all employees), Employees page (list + add/edit)."
    type: polecat
    depends_on: [11]
    label: manager-dashboard
    
  - task: "Build CSV import UI: CSVImportModal with drag-drop upload, column mapping interface, validation preview (show errors), import button. Use PapaParse for CSV parsing. Call shift.bulkCreate API."
    type: polecat
    depends_on: [5, 10]
    label: csv-import-ui
    
  - task: "Build notification UI: NotificationDropdown component (bell icon with unread badge), dropdown list (last 10 notifications), click notification → navigate to link, mark all read button."
    type: polecat
    depends_on: [9, 10]
    label: notification-ui
    
  # Phase 5: Testing & Documentation
  - task: "Write integration tests: Test auth flow (login, protected routes). Test swap workflow (create → approve → shift updates). Test CSV import (valid + invalid data). Test multi-tenancy isolation (user from Org A can't access Org B data)."
    type: polecat
    depends_on: [7, 8, 9, 14]
    label: integration-tests
    
  - task: "Write deployment guide: Railway setup (backend + database), Vercel setup (frontend), environment variables, database migration steps, seed script for William's company (23 locations + users)."
    type: dog
    depends_on: [16]
    label: deployment-docs
    
  - task: "Write user documentation: Employee guide (how to request swap, request time off), Manager guide (how to approve requests, create shifts, use templates), Admin guide (setup org, add locations, invite users, import CSV)."
    type: dog
    depends_on: [12, 13, 14]
    label: user-docs
```

### Execution Plan

**Night 1 (Steps 0-2):** Foundation
- Repo setup + dependencies
- Database schema + RLS
- Authentication system

**Night 2 (Steps 3-6):** Core APIs (parallel)
- Org/location management
- User management
- Shift CRUD
- Templates

**Night 3 (Steps 7-9):** Workflows (parallel)
- Swap requests
- Time-off requests
- Notifications (email/SMS)

**Night 4 (Steps 10-15):** Frontend (parallel)
- Layout + navigation
- Calendar UI
- Employee dashboard
- Manager dashboard
- CSV import
- Notification UI

**Night 5 (Steps 16-18):** Polish
- Integration tests
- Deployment docs
- User docs

**Total: 5 nights = 1 week (including review days)**

### Daily Review Workflow

**Each morning:**
1. Check SGT web UI: http://localhost:4747
2. Review overnight PRs (4-6 PRs per night)
3. Merge what works, flag issues
4. Spawn follow-up agents for bugs/gaps
5. Test locally (run migrations, start dev server)

**Evening:**
- Queue next night's work
- Adjust molecule if needed (skip/add steps)

---

## Week 1 Timeline (Detailed)

**Monday:**
- Morning: Set up SGT, create repo, write spec (DONE)
- Evening: Dispatch Night 1 work (repo + DB + auth)

**Tuesday:**
- Morning: Review PRs from Night 1, merge, test locally
- Evening: Dispatch Night 2 work (core APIs)

**Wednesday:**
- Morning: Review Night 2 PRs, test API endpoints (Postman/Insomnia)
- Evening: Dispatch Night 3 work (workflows)

**Thursday:**
- Morning: Review Night 3 PRs, test swap workflow manually
- Evening: Dispatch Night 4 work (frontend)

**Friday:**
- Morning: Review Night 4 PRs, test UI flows
- Afternoon: Polish (fix bugs, adjust styling)
- Evening: Dispatch Night 5 work (tests + docs)

**Saturday:**
- Morning: Review Night 5 PRs
- Afternoon: Deploy to Railway + Vercel
- Evening: Seed William's company data (23 locations)

**Sunday:**
- Morning: Train admin/managers (30 min call)
- Afternoon: Run parallel (ShiftSwap + When I Work)
- Evening: Monitor for issues

**Monday Week 2:**
- Cancel When I Work subscription
- Full cutover to ShiftSwap
- 🎉 $800/month savings achieved

---

## Success Criteria

**Must-Have (Week 1):**
- [ ] Multi-tenant database with RLS working
- [ ] JWT authentication functional
- [ ] Shift CRUD (create, view, edit, delete)
- [ ] Swap request workflow (request → approve/deny → notifications)
- [ ] Manager approval dashboard (pending swaps visible)
- [ ] Email notifications working (swap request, approval)
- [ ] CSV import functional (migrate from When I Work)
- [ ] Weekly calendar UI (responsive, works on mobile)
- [ ] Deployed to production (Railway + Vercel)
- [ ] William's company data seeded (23 locations, users, shifts)

**Nice-to-Have (Week 2-3):**
- [ ] SMS notifications (Twilio integration)
- [ ] Time-off requests (full workflow)
- [ ] Shift templates (recurring schedules)
- [ ] Mobile app (React Native or PWA)
- [ ] Advanced reporting (hours worked, swap frequency)
- [ ] Audit log UI (admin visibility)

**Not Needed for MVP:**
- Payroll integration
- Time clock (clock in/out)
- Labor law compliance checks
- Advanced scheduling algorithms (auto-fill open shifts)

---

## Security Considerations

**Authentication:**
- Passwords hashed with bcrypt (cost factor 10)
- JWT tokens in httpOnly cookies (not localStorage)
- CSRF protection (SameSite cookie attribute)
- Token expiration (7 days)

**Authorization:**
- Role-based access control (RBAC)
- Row-level security (RLS) for multi-tenancy
- API rate limiting (100 req/min per user)

**Data Protection:**
- PostgreSQL SSL connections required
- HTTPS enforced (no HTTP)
- Sensitive data encrypted at rest (database-level)
- No PII in logs

**Audit Trail:**
- All sensitive actions logged (swap approvals, user changes)
- Audit log immutable (no delete, only append)
- Retention: 2 years

---

## Open Questions (for William to Answer)

1. **Billing:** Do we need Stripe integration Week 1, or manual invoicing OK initially?
2. **Custom domain:** shiftswap.app or company-specific (e.g., shifts.pediatricgroup.com)?
3. **Support:** Who handles customer support? (You, or hire VA?)
4. **Legal:** Do we need Terms of Service / Privacy Policy before external sales?
5. **Marketing:** How will you acquire first 5 customers? (Cold email, referrals, ads?)

---

## Final Notes

**This spec is SGT-ready:**
- Detailed enough for autonomous agent execution
- Broken into discrete tasks (each task = 1 PR)
- Dependencies clearly defined
- Testable outputs

**What happens next:**
1. William reviews spec (adds/removes features)
2. We send to aj_main for technical review
3. Create GitHub repo + initialize SGT
4. Write molecule YAML (based on this spec)
5. Dispatch tonight → agents build overnight
6. William reviews PRs tomorrow morning
7. Repeat for 5 nights → production-ready app

**Week 1 goal: Replace When I Work, save $800/month.**

**Week 2+ goal: Sell to external customers, hit $2k MRR.**

---

**Spec Version 1.0 - Ready for Review**
