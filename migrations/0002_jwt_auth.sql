-- Migration: JWT Authentication
-- Removes Supabase auth.users dependency, adds password_hash for custom JWT auth

-- ============================================================================
-- 1. Drop the trigger and function that relied on auth.users
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ============================================================================
-- 2. Remove the foreign key reference to auth.users from the users table
-- ============================================================================

-- Drop the existing primary key constraint (which references auth.users)
-- and recreate it as a self-contained UUID primary key
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_pkey CASCADE;

ALTER TABLE public.users
  ADD PRIMARY KEY (id);

ALTER TABLE public.users
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- ============================================================================
-- 3. Add password_hash column for bcrypt-hashed passwords
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Make password_hash NOT NULL for new rows (existing rows will need backfill)
-- For now, set a placeholder for any existing rows without a hash
UPDATE public.users SET password_hash = '' WHERE password_hash IS NULL;
ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL;

-- ============================================================================
-- 4. Add unique email index (global, not just per-org) for login lookups
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- ============================================================================
-- 5. Update RLS policies that referenced auth.uid()
-- ============================================================================

-- Drop policies that reference auth.uid() (they will fail without Supabase)
DROP POLICY IF EXISTS "org_isolation_update" ON public.organizations;
DROP POLICY IF EXISTS "org_isolation_insert" ON public.org_members;
DROP POLICY IF EXISTS "org_isolation_update" ON public.org_members;
DROP POLICY IF EXISTS "org_isolation_delete" ON public.org_members;

-- Recreate without auth.uid() references (app layer handles user auth)
CREATE POLICY "org_isolation_update" ON public.organizations
  FOR UPDATE USING (
    id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_insert" ON public.org_members
  FOR INSERT WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_update" ON public.org_members
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );

CREATE POLICY "org_isolation_delete" ON public.org_members
  FOR DELETE USING (
    org_id = current_setting('app.current_org_id', true)::uuid
  );
