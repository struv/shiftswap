-- Notifications migration
-- Adds notifications table for in-app notification system

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('swap_request', 'swap_approved', 'swap_denied')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching unread notifications efficiently
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Index for fetching all recent notifications for a user
CREATE INDEX idx_notifications_user_recent ON public.notifications(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Insert policy: allow service-level inserts (notifications are created by the app, not directly by users)
-- The app inserts via the authenticated Supabase client on behalf of the system
CREATE POLICY "Authenticated users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
