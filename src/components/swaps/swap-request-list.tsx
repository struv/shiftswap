"use client";

import { useState } from "react";
import { SwapRequestWithDetails, SwapRequestStatus, UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const statusVariantMap: Record<SwapRequestStatus, "pending" | "approved" | "denied" | "cancelled"> = {
  pending: "pending",
  approved: "approved",
  denied: "denied",
  cancelled: "cancelled",
};

const statusLabels: Record<SwapRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  cancelled: "Cancelled",
};

interface SwapRequestListProps {
  requests: SwapRequestWithDetails[];
  currentUserId: string;
  userRole: UserRole;
}

export function SwapRequestList({
  requests,
  currentUserId,
  userRole,
}: SwapRequestListProps) {
  const [detailRequest, setDetailRequest] = useState<SwapRequestWithDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isManager = userRole === "manager" || userRole === "admin";

  // Split requests into user's own and manager queue
  const myRequests = requests.filter((r) => r.requester_id === currentUserId);
  const pendingApprovals = isManager
    ? requests.filter(
        (r) => r.status === "pending" && r.requester_id !== currentUserId
      )
    : [];

  async function handleAction(requestId: string, action: "approved" | "denied") {
    setActionLoading(requestId + action);
    try {
      const res = await fetch("/swaps/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel(requestId: string) {
    setActionLoading(requestId + "cancel");
    try {
      const res = await fetch("/swaps/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "cancelled" }),
      });
      if (res.ok) {
        window.location.reload();
      }
    } finally {
      setActionLoading(null);
    }
  }

  function openDetail(request: SwapRequestWithDetails) {
    setDetailRequest(request);
    setDialogOpen(true);
  }

  function renderRequestCard(request: SwapRequestWithDetails, showActions: boolean) {
    const shift = request.shift;
    const dateStr = new Date(shift.date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    return (
      <div
        key={request.id}
        className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow cursor-pointer"
        onClick={() => openDetail(request)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{request.requester.name}</span>
            <Badge variant={statusVariantMap[request.status]}>
              {statusLabels[request.status]}
            </Badge>
          </div>
          <div className="text-sm text-gray-600">
            {dateStr} &middot; {shift.start_time.slice(0, 5)} -{" "}
            {shift.end_time.slice(0, 5)} &middot;{" "}
            <span className="capitalize">{shift.role}</span>
          </div>
          {request.reason && (
            <p className="text-xs text-gray-500 mt-1 truncate">
              {request.reason}
            </p>
          )}
        </div>

        {showActions && request.status === "pending" && (
          <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="success"
              onClick={() => handleAction(request.id, "approved")}
              disabled={actionLoading !== null}
            >
              {actionLoading === request.id + "approved" ? "..." : "Approve"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleAction(request.id, "denied")}
              disabled={actionLoading !== null}
            >
              {actionLoading === request.id + "denied" ? "..." : "Deny"}
            </Button>
          </div>
        )}

        {!showActions && request.status === "pending" && request.requester_id === currentUserId && (
          <div className="ml-4" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCancel(request.id)}
              disabled={actionLoading !== null}
            >
              {actionLoading === request.id + "cancel" ? "..." : "Cancel"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Manager pending approvals queue */}
      {isManager && pendingApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Approvals
              <Badge variant="pending">{pendingApprovals.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((req) => renderRequestCard(req, true))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User's swap requests */}
      <Card>
        <CardHeader>
          <CardTitle>My Swap Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {myRequests.length > 0 ? (
            <div className="space-y-3">
              {myRequests.map((req) => renderRequestCard(req, false))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              You haven&apos;t made any swap requests yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* All swap requests (manager view) */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>All Swap Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length > 0 ? (
              <div className="space-y-3">
                {requests
                  .filter((r) => r.requester_id !== currentUserId)
                  .map((req) => renderRequestCard(req, req.status === "pending"))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No swap requests found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          {detailRequest && (
            <>
              <DialogHeader>
                <DialogTitle>Swap Request Details</DialogTitle>
                <DialogDescription>
                  Submitted{" "}
                  {new Date(detailRequest.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Status:</span>
                  <Badge variant={statusVariantMap[detailRequest.status]}>
                    {statusLabels[detailRequest.status]}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Requester</p>
                    <p className="font-medium">{detailRequest.requester.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Shift Date</p>
                    <p className="font-medium">
                      {new Date(
                        detailRequest.shift.date + "T00:00:00"
                      ).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-medium">
                      {detailRequest.shift.start_time.slice(0, 5)} -{" "}
                      {detailRequest.shift.end_time.slice(0, 5)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Role</p>
                    <p className="font-medium capitalize">
                      {detailRequest.shift.role}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="font-medium">{detailRequest.shift.department}</p>
                  </div>
                  {detailRequest.reviewer && (
                    <div>
                      <p className="text-sm text-gray-500">Reviewed By</p>
                      <p className="font-medium">{detailRequest.reviewer.name}</p>
                    </div>
                  )}
                </div>

                {detailRequest.reason && (
                  <div>
                    <p className="text-sm text-gray-500">Reason</p>
                    <p className="text-sm mt-1 bg-gray-50 rounded p-3">
                      {detailRequest.reason}
                    </p>
                  </div>
                )}
              </div>

              {isManager && detailRequest.status === "pending" && (
                <DialogFooter>
                  <Button
                    variant="success"
                    onClick={() => {
                      handleAction(detailRequest.id, "approved");
                      setDialogOpen(false);
                    }}
                    disabled={actionLoading !== null}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleAction(detailRequest.id, "denied");
                      setDialogOpen(false);
                    }}
                    disabled={actionLoading !== null}
                  >
                    Deny
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
