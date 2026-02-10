-- ShiftSwap: Complete Initial Schema with RLS
-- Multi-tenant database schema for shift scheduling and swap management
-- All tables scoped by org_id with Row-Level Security enforced via
-- current_setting('app.current_org_id', true)::uuid

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Auto-update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Set org context session variable for RLS enforcement
-- Uses SECURITY DEFINER so it can be called by any authenticated user
-- The `true` parameter to set_config scopes to the current transaction
CREATE OR REPLACE FUNCTION public.set_org_context(org_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Tables
-- ============================================================================

-- ---------------------------------------------------------------------------
-- organizations: Top-level tenant
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- ---------------------------------------------------------------------------
-- locations: Physical locations within an org (e.g. clinic sites)
-- ---------------------------------------------------------------------------
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_org_id ON public.locations(org_id);

-- ---------------------------------------------------------------------------
-- users: Employee / manager / admin profiles
-- Linked to Supabase auth.users for authentication
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('staff', 'manager', 'admin')),
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_org_email ON public.users(org_id, email);
CREATE INDEX idx_users_org_id ON public.users(org_id);

-- ---------------------------------------------------------------------------
-- user_locations: Many-to-many mapping of users to locations
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

CREATE INDEX idx_user_locations_org_id ON public.user_locations(org_id);

-- ---------------------------------------------------------------------------
-- org_members: User-to-org role mapping (admin / manager / staff)
-- ---------------------------------------------------------------------------
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff'
    CHECK (role IN ('admin', 'manager', 'staff')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);

-- ---------------------------------------------------------------------------
-- shifts: Scheduled work periods
-- ---------------------------------------------------------------------------
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shifts_org_id ON public.shifts(org_id);
CREATE INDEX idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX idx_shifts_date ON public.shifts(date);
CREATE INDEX idx_shifts_org_location ON public.shifts(org_id, location_id);

-- ---------------------------------------------------------------------------
-- callouts: Staff unable to work a scheduled shift
-- ---------------------------------------------------------------------------
CREATE TABLE public.callouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'claimed', 'approved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_callouts_org_id ON public.callouts(org_id);
CREATE INDEX idx_callouts_status ON public.callouts(status);
CREATE INDEX idx_callouts_shift_id ON public.callouts(shift_id);

-- ---------------------------------------------------------------------------
-- claims: Users claiming open callout shifts
-- ---------------------------------------------------------------------------
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  callout_id UUID NOT NULL REFERENCES public.callouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_org_id ON public.claims(org_id);
CREATE INDEX idx_claims_callout_id ON public.claims(callout_id);
CREATE INDEX idx_claims_status ON public.claims(status);

-- ---------------------------------------------------------------------------
-- swap_requests: Shift swap workflow
-- ---------------------------------------------------------------------------
CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swap_requests_org_id ON public.swap_requests(org_id);
CREATE INDEX idx_swap_requests_shift_id ON public.swap_requests(shift_id);
CREATE INDEX idx_swap_requests_requested_by ON public.swap_requests(requested_by);
CREATE INDEX idx_swap_requests_org_status ON public.swap_requests(org_id, status);

-- ---------------------------------------------------------------------------
-- notifications: In-app notification system
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
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

CREATE INDEX idx_notifications_org_id ON public.notifications(org_id);
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- ============================================================================
-- Triggers: auto-update updated_at
-- ============================================================================

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_callouts_updated_at
  BEFORE UPDATE ON public.callouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Trigger: auto-create user profile on Supabase auth signup
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, org_id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'org_id')::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid
    ),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'staff'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================
-- All policies use current_setting('app.current_org_id', true)::uuid
-- The application layer sets this session variable before executing queries.
-- The second parameter `true` prevents errors when the variable is not set.

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.callouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.organizations
  FOR SELECT USING (
    id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.organizations
  FOR UPDATE USING (
    id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.locations
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.locations
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.locations
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_delete" ON public.locations
  FOR DELETE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.users
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.users
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- user_locations
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.user_locations
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.user_locations
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.user_locations
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_delete" ON public.user_locations
  FOR DELETE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- org_members
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.org_members
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.org_members
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "org_isolation_update" ON public.org_members
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "org_isolation_delete" ON public.org_members
  FOR DELETE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.shifts
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.shifts
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.shifts
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_delete" ON public.shifts
  FOR DELETE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- callouts
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.callouts
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.callouts
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.callouts
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- claims
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.claims
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.claims
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.claims
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- swap_requests
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.swap_requests
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.swap_requests
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.swap_requests
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE POLICY "org_isolation_select" ON public.notifications
  FOR SELECT USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.notifications
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );
