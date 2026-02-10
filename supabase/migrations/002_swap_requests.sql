-- Swap Requests table for shift swap workflow
CREATE TABLE public.swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  replacement_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_swap_requests_shift_id ON public.swap_requests(shift_id);
CREATE INDEX idx_swap_requests_requester_id ON public.swap_requests(requester_id);
CREATE INDEX idx_swap_requests_status ON public.swap_requests(status);

-- RLS
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Everyone can view swap requests
CREATE POLICY "Anyone can view swap requests" ON public.swap_requests
  FOR SELECT USING (true);

-- Staff can create swap requests for their own shifts
CREATE POLICY "Users can create swap requests for own shifts" ON public.swap_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requester_id AND
    EXISTS (SELECT 1 FROM public.shifts WHERE id = shift_id AND user_id = auth.uid())
  );

-- Requester can update own pending requests (cancel), managers can update any
CREATE POLICY "Users can update own or managers can update any" ON public.swap_requests
  FOR UPDATE USING (
    auth.uid() = requester_id OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Trigger for updated_at
CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Also update shifts RLS to allow managers to update any shift (for swap approvals)
CREATE POLICY "Managers can update any shift" ON public.shifts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Allow managers to insert shifts
CREATE POLICY "Managers can insert shifts" ON public.shifts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );

-- Allow managers to delete shifts
CREATE POLICY "Managers can delete shifts" ON public.shifts
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('manager', 'admin'))
  );
