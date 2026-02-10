import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { User, SwapRequest } from "@/types/database";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { requestId, action } = body as {
    requestId: string;
    action: "approved" | "denied" | "cancelled";
  };

  if (!requestId || !action) {
    return NextResponse.json(
      { error: "Missing requestId or action" },
      { status: 400 }
    );
  }

  // Get the swap request
  const { data: swapRequest } = (await supabase
    .from("swap_requests")
    .select("*")
    .eq("id", requestId)
    .single()) as { data: SwapRequest | null };

  if (!swapRequest) {
    return NextResponse.json(
      { error: "Swap request not found" },
      { status: 404 }
    );
  }

  // For cancel action, only the requester can cancel
  if (action === "cancelled") {
    if (swapRequest.requester_id !== user.id) {
      return NextResponse.json(
        { error: "Only the requester can cancel" },
        { status: 403 }
      );
    }
  } else {
    // For approve/deny, must be a manager
    const { data: profile } = (await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single()) as { data: User | null };

    if (!profile || (profile.role !== "manager" && profile.role !== "admin")) {
      return NextResponse.json(
        { error: "Only managers can approve or deny requests" },
        { status: 403 }
      );
    }
  }

  // Update the swap request
  const updatePayload: Partial<SwapRequest> = { status: action };
  if (action === "approved" || action === "denied") {
    updatePayload.reviewed_by = user.id;
    updatePayload.reviewed_at = new Date().toISOString();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("swap_requests")
    .update(updatePayload)
    .eq("id", requestId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update request" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
