-- Swap Requests migration
-- Adds swap_requests table for shift swap workflow

CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  manager_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_swap_requests_shift_id ON public.swap_requests(shift_id);
CREATE INDEX idx_swap_requests_requested_by ON public.swap_requests(requested_by);
CREATE INDEX idx_swap_requests_status ON public.swap_requests(status);

-- Enable RLS
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view swap requests" ON public.swap_requests
  FOR SELECT USING (true);

CREATE POLICY "Users can create swap requests" ON public.swap_requests
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Managers can update swap requests" ON public.swap_requests
  FOR UPDATE USING (
    -- Requester can cancel their own, or managers/admins can approve/deny
    auth.uid() = requested_by
    OR EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('manager', 'admin')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
