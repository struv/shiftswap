-- ShiftSwap Complete Schema Migration
-- Adds all remaining tables, org_id columns, RLS policies, and indexes.
-- Depends on: 001_initial_schema.sql, 002_org_context.sql

-- =========================================================================
-- 1. ALTER existing tables to add org_id and new columns
-- =========================================================================

-- Users: add org_id, first_name, last_name, status
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Shifts: add org_id, location_id, notes; widen time columns to timestamptz
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS location_id UUID,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Callouts: add org_id for RLS
ALTER TABLE public.callouts
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Claims: add org_id for RLS
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- =========================================================================
-- 2. CREATE new tables
-- =========================================================================

-- Locations (clinics / offices within an org)
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK for shifts.location_id now that locations table exists
ALTER TABLE public.shifts
  ADD CONSTRAINT fk_shifts_location
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE CASCADE;

-- User locations (employees can work at multiple locations)
CREATE TABLE IF NOT EXISTS public.user_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

-- Shift templates (recurring weekly schedules)
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template shift definitions
CREATE TABLE IF NOT EXISTS public.template_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.shift_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT,
  notes TEXT
);

-- Swap requests
CREATE TABLE IF NOT EXISTS public.swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  original_shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'canceled')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit logs (immutable)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- 3. Indexes
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_locations_org ON public.locations(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(org_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_org ON public.user_locations(org_id);
CREATE INDEX IF NOT EXISTS idx_shifts_org_location ON public.shifts(org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_time ON public.shifts(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_shift_templates_org ON public.shift_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_template_shifts_template ON public.template_shifts(template_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_org_status ON public.swap_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_swap_requests_shift ON public.swap_requests(original_shift_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON public.notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON public.audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Unique constraint for users (org_id, email)
CREATE UNIQUE INDEX IF NOT EXISTS users_org_email_unique
  ON public.users(org_id, email);

-- =========================================================================
-- 4. Enable Row-Level Security on all new tables
-- =========================================================================

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 5. RLS Policies — org isolation via app.current_org_id session variable
-- =========================================================================

-- Locations
CREATE POLICY org_isolation_select ON public.locations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.locations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.locations
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- User Locations
CREATE POLICY org_isolation_select ON public.user_locations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.user_locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.user_locations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.user_locations
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shifts (replace old permissive policies with org-scoped ones)
-- Drop existing policies that don't enforce org isolation
DROP POLICY IF EXISTS "Anyone can view shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can insert own shifts" ON public.shifts;
DROP POLICY IF EXISTS "Users can update own shifts" ON public.shifts;

CREATE POLICY org_isolation_select ON public.shifts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.shifts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.shifts
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shift Templates
CREATE POLICY org_isolation_select ON public.shift_templates
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.shift_templates
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.shift_templates
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.shift_templates
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Template Shifts
CREATE POLICY org_isolation_select ON public.template_shifts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.template_shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.template_shifts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.template_shifts
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Swap Requests
CREATE POLICY org_isolation_select ON public.swap_requests
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.swap_requests
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.swap_requests
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.swap_requests
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Notifications
CREATE POLICY org_isolation_select ON public.notifications
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.notifications
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.notifications
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON public.notifications
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit Logs (insert-only for application; select for viewing)
CREATE POLICY org_isolation_select ON public.audit_logs
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.audit_logs
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Callouts: add org-scoped policies
DROP POLICY IF EXISTS "Anyone can view callouts" ON public.callouts;
DROP POLICY IF EXISTS "Users can create callouts for own shifts" ON public.callouts;
DROP POLICY IF EXISTS "Users can update own callouts" ON public.callouts;

CREATE POLICY org_isolation_select ON public.callouts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.callouts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.callouts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Claims: add org-scoped policies
DROP POLICY IF EXISTS "Anyone can view claims" ON public.claims;
DROP POLICY IF EXISTS "Users can create claims" ON public.claims;
DROP POLICY IF EXISTS "Managers can update claims" ON public.claims;

CREATE POLICY org_isolation_select ON public.claims
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON public.claims
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON public.claims
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- =========================================================================
-- 6. Triggers for updated_at on new tables
-- =========================================================================

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON public.shift_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
