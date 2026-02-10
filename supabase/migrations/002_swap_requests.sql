-- Swap Requests table
-- Allows employees to request a swap for their shift
CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_swap_requests_requester ON public.swap_requests(requester_id);
CREATE INDEX idx_swap_requests_shift ON public.swap_requests(shift_id);
CREATE INDEX idx_swap_requests_status ON public.swap_requests(status);

-- Enable RLS
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Everyone can view swap requests
CREATE POLICY "Anyone can view swap requests" ON public.swap_requests
  FOR SELECT USING (true);

-- Users can create swap requests for their own shifts
CREATE POLICY "Users can create swap requests for own shifts" ON public.swap_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id AND
    EXISTS (SELECT 1 FROM public.shifts WHERE id = shift_id AND user_id = auth.uid())
  );

-- Users can cancel their own swap requests
CREATE POLICY "Users can update own swap requests" ON public.swap_requests
  FOR UPDATE USING (auth.uid() = requester_id);

-- Managers can update any swap request (approve/deny)
CREATE POLICY "Managers can update swap requests" ON public.swap_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
