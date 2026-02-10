import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SwapRequest, User } from '@/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

// Helper for swap_requests queries since the table isn't in the generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function swapTable(supabase: SupabaseClient<any>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('swap_requests');
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, action } = body as { id: string; action: 'approve' | 'deny' | 'cancel' };

  if (!id || !action) {
    return NextResponse.json({ error: 'Missing id or action' }, { status: 400 });
  }

  // Fetch the swap request first
  const { data: swapRequest } = await swapTable(supabase)
    .select('*')
    .eq('id', id)
    .single() as { data: SwapRequest | null };

  if (!swapRequest) {
    return NextResponse.json({ error: 'Swap request not found' }, { status: 404 });
  }

  if (swapRequest.status !== 'pending') {
    return NextResponse.json(
      { error: 'Swap request is no longer pending' },
      { status: 400 }
    );
  }

  if (action === 'cancel') {
    if (swapRequest.requested_by !== user.id) {
      return NextResponse.json(
        { error: 'Only the requester can cancel this request' },
        { status: 403 }
      );
    }

    const { data, error } = await swapTable(supabase)
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single() as { data: SwapRequest | null; error: { message: string } | null };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ swapRequest: data });
  }

  if (action === 'approve' || action === 'deny') {
    const { data: profile } = (await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()) as { data: User | null };

    if (!profile || (profile.role !== 'manager' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only managers can approve or deny swap requests' },
        { status: 403 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'denied';

    const { data, error } = await swapTable(supabase)
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single() as { data: SwapRequest | null; error: { message: string } | null };

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ swapRequest: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
