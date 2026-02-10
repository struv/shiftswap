-- ShiftSwap Multi-Tenant Schema Migration
-- Replaces simplified MVP schema with full multi-tenant design
-- All tables have org_id for RLS-based organization isolation

-- Drop old simplified tables (from 001_initial_schema.sql)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_callouts_updated_at ON public.callouts;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS public.claims CASCADE;
DROP TABLE IF EXISTS public.callouts CASCADE;
DROP TABLE IF EXISTS public.shifts CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================
-- Core Tables
-- ============================================================

-- Organizations (top-level tenant)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Locations within an org (e.g., 23 clinics)
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (employees + managers)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_org_email_unique UNIQUE(org_id, email)
);

-- User-location assignments (employees can work at multiple locations)
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_locations_user_location_unique UNIQUE(user_id, location_id)
);

-- ============================================================
-- Scheduling Tables
-- ============================================================

-- Shifts
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  role TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shift templates (recurring weekly schedules)
CREATE TABLE shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Template shift definitions
CREATE TABLE template_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES shift_templates(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT,
  notes TEXT
);

-- ============================================================
-- Request Tables
-- ============================================================

-- Swap requests
CREATE TABLE swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  original_shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time-off requests
CREATE TABLE time_off_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- System Tables
-- ============================================================

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log (append-only)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_locations_org ON locations(org_id);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_user_locations_org ON user_locations(org_id);
CREATE INDEX idx_shifts_org_location ON shifts(org_id, location_id);
CREATE INDEX idx_shifts_user_time ON shifts(user_id, start_time);
CREATE INDEX idx_shift_templates_org ON shift_templates(org_id, location_id);
CREATE INDEX idx_template_shifts_template ON template_shifts(template_id);
CREATE INDEX idx_swap_requests_org_status ON swap_requests(org_id, status);
CREATE INDEX idx_swap_requests_requested_by ON swap_requests(requested_by);
CREATE INDEX idx_time_off_requests_org_status ON time_off_requests(org_id, status);
CREATE INDEX idx_time_off_requests_user ON time_off_requests(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_org ON notifications(org_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON shift_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON swap_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON time_off_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Row-Level Security (RLS)
-- ============================================================
-- Multi-tenancy via app.current_org_id session variable.
-- Application middleware sets: SELECT set_config('app.current_org_id', '<uuid>', false);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Organizations
CREATE POLICY org_isolation_select ON organizations
  FOR SELECT USING (id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON organizations
  FOR UPDATE USING (id = current_setting('app.current_org_id', true)::uuid);

-- Locations
CREATE POLICY org_isolation_select ON locations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON locations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON locations
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Users
CREATE POLICY org_isolation_select ON users
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON users
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON users
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON users
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- User Locations
CREATE POLICY org_isolation_select ON user_locations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON user_locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON user_locations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON user_locations
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shifts
CREATE POLICY org_isolation_select ON shifts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON shifts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON shifts
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shift Templates
CREATE POLICY org_isolation_select ON shift_templates
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON shift_templates
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON shift_templates
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON shift_templates
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Template Shifts
CREATE POLICY org_isolation_select ON template_shifts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON template_shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON template_shifts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON template_shifts
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Swap Requests
CREATE POLICY org_isolation_select ON swap_requests
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON swap_requests
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON swap_requests
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON swap_requests
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Time Off Requests
CREATE POLICY org_isolation_select ON time_off_requests
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON time_off_requests
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON time_off_requests
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON time_off_requests
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Notifications
CREATE POLICY org_isolation_select ON notifications
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON notifications
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_update ON notifications
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_delete ON notifications
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit Logs (insert + select only — immutable)
CREATE POLICY org_isolation_select ON audit_logs
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);
CREATE POLICY org_isolation_insert ON audit_logs
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
