-- ShiftSwap Multi-Tenant Schema
-- Migration: 0001_initial_schema
-- All tables use org_id for Row-Level Security isolation.
-- RLS policies use current_setting('app.current_org_id')::uuid.

-- =========================================================================
-- Extensions
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- Enums
-- =========================================================================

CREATE TYPE org_plan AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE org_status AS ENUM ('active', 'suspended');
CREATE TYPE member_role AS ENUM ('admin', 'manager', 'staff');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'invited');
CREATE TYPE swap_status AS ENUM ('pending', 'approved', 'denied', 'canceled');
CREATE TYPE notification_type AS ENUM (
  'swap_requested',
  'swap_approved',
  'swap_denied',
  'shift_assigned',
  'shift_updated',
  'general'
);

-- =========================================================================
-- Tables
-- =========================================================================

-- Organizations
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  settings    JSONB DEFAULT '{}',
  plan        org_plan NOT NULL DEFAULT 'free',
  status      org_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Org Members — maps auth users to orgs with roles
CREATE TABLE org_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,  -- references auth.users(id)
  role        member_role NOT NULL DEFAULT 'staff',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_org_members_user_org ON org_members(user_id, org_id);
CREATE INDEX idx_org_members_org_id ON org_members(org_id);

-- Locations
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  timezone    TEXT NOT NULL DEFAULT 'America/New_York',
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_org_id ON locations(org_id);

-- Users — profile data, linked to Supabase auth.users
CREATE TABLE users (
  id          UUID PRIMARY KEY,  -- same as auth.users.id
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  phone       TEXT,
  role        member_role NOT NULL DEFAULT 'staff',
  status      user_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_org_email ON users(org_id, email);
CREATE INDEX idx_users_org_id ON users(org_id);

-- User ↔ Location join table
CREATE TABLE user_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_user_locations_user_location ON user_locations(user_id, location_id);
CREATE INDEX idx_user_locations_org_id ON user_locations(org_id);

-- Shifts
CREATE TABLE shifts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_time  TIMESTAMPTZ NOT NULL,
  end_time    TIMESTAMPTZ NOT NULL,
  role        TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_org_location ON shifts(org_id, location_id);
CREATE INDEX idx_shifts_user_time ON shifts(user_id, start_time);
CREATE INDEX idx_shifts_org_id ON shifts(org_id);

-- Swap Requests
CREATE TABLE swap_requests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  original_shift_id   UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  requested_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason              TEXT,
  status              swap_status NOT NULL DEFAULT 'pending',
  reviewed_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  manager_notes       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_swap_requests_org_status ON swap_requests(org_id, status);
CREATE INDEX idx_swap_requests_org_id ON swap_requests(org_id);

-- Notifications
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  link        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at)
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_org_id ON notifications(org_id);

-- =========================================================================
-- updated_at trigger function
-- =========================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to tables that have the column
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_org_members_updated_at
  BEFORE UPDATE ON org_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_swap_requests_updated_at
  BEFORE UPDATE ON swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================================================
-- Row-Level Security (RLS)
-- =========================================================================
-- All org-scoped tables use: current_setting('app.current_org_id', true)::uuid
-- The second argument (true) prevents errors when the setting is unset,
-- returning NULL instead (which safely denies all rows).
-- =========================================================================

-- Organizations: only visible if id matches the session org
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON organizations
  USING (id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_insert ON organizations
  FOR INSERT WITH CHECK (true);  -- org creation is unrestricted

-- Org Members
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_members_isolation ON org_members
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_members_insert ON org_members
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Locations
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY locations_isolation ON locations
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY locations_insert ON locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_isolation ON users
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- User Locations
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_locations_isolation ON user_locations
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY user_locations_insert ON user_locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY shifts_isolation ON shifts
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY shifts_insert ON shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Swap Requests
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY swap_requests_isolation ON swap_requests
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY swap_requests_insert ON swap_requests
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_isolation ON notifications
  USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY notifications_insert ON notifications
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
