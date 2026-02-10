-- Notifications table for in-app notification system
-- Supports swap event triggers and future email integration

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'swap_request',
    'swap_approved',
    'swap_denied',
    'shift_claimed',
    'general'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,                          -- deep link to relevant page (e.g. /callouts/abc)
  read_at TIMESTAMPTZ,               -- NULL = unread
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX idx_notifications_user_recent
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_org_id
  ON public.notifications(org_id);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see their own notifications within their org
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (
    user_id = auth.uid()
    AND org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (
    user_id = auth.uid()
    AND org_id = current_setting('app.current_org_id', true)::uuid
  );

-- Server-side insert (via service role or RLS bypass for triggers)
-- Application code inserts notifications using org context
CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    org_id = current_setting('app.current_org_id', true)::uuid
  );
