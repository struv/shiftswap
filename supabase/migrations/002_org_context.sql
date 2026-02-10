-- Organization context migration
-- Adds organizations and org_members tables for multi-tenancy
-- Sets up RLS policies using app.current_org_id session variable

-- Organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'canceled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Org members table (maps users to organizations with roles)
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX idx_organizations_slug ON public.organizations(slug);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- RLS policies for organizations
-- Users can view orgs they belong to
CREATE POLICY "Members can view their organization"
  ON public.organizations FOR SELECT
  USING (
    id = current_setting('app.current_org_id', true)::uuid
  );

-- Only admins can update their org
CREATE POLICY "Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- RLS policies for org_members
-- Members can view other members in their org
CREATE POLICY "Members can view org members"
  ON public.org_members FOR SELECT
  USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Admins can manage org members
CREATE POLICY "Admins can insert org members"
  ON public.org_members FOR INSERT
  WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update org members"
  ON public.org_members FOR UPDATE
  USING (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete org members"
  ON public.org_members FOR DELETE
  USING (
    org_id = current_setting('app.current_org_id', true)::uuid
    AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = current_setting('app.current_org_id', true)::uuid
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );

-- Trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to set org context session variable for RLS
-- Called from application layer before running org-scoped queries
CREATE OR REPLACE FUNCTION public.set_org_context(org_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
