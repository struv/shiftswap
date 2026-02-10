'use client';

import { useState } from 'react';
import { Check, X, Clock, ArrowLeftRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { UserRole, SwapRequestStatus } from '@/types/database';

interface SwapRequestData {
  id: string;
  org_id: string;
  shift_id: string;
  requested_by: string;
  reason: string | null;
  status: SwapRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  shift: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    role: string;
    department: string;
    user_id: string;
  };
  requester: {
    id: string;
    name: string;
    email: string;
    role: string;
    department: string | null;
  };
}

interface SwapRequestsListProps {
  initialRequests: SwapRequestData[];
  currentUserId: string;
  userRole: UserRole;
}

const STATUS_BADGE_MAP: Record<SwapRequestStatus, BadgeProps['variant']> = {
  pending: 'pending',
  approved: 'approved',
  denied: 'denied',
  cancelled: 'cancelled',
};

function formatShiftDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function SwapRequestsList({
  initialRequests,
  currentUserId,
  userRole,
}: SwapRequestsListProps) {
  const [requests, setRequests] = useState<SwapRequestData[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<SwapRequestData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'mine'>('all');

  const isManager = userRole === 'manager' || userRole === 'admin';

  const filteredRequests = requests.filter((req) => {
    if (filter === 'pending') return req.status === 'pending';
    if (filter === 'mine') return req.requested_by === currentUserId;
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const myRequestsCount = requests.filter((r) => r.requested_by === currentUserId).length;

  async function handleAction(id: string, action: 'approve' | 'deny' | 'cancel') {
    setActionLoading(id);
    try {
      const res = await fetch('/api/swaps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });

      if (res.ok) {
        const data = await res.json();
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: data.swapRequest.status, reviewed_by: data.swapRequest.reviewed_by, reviewed_at: data.swapRequest.reviewed_at } : r
          )
        );
        setSelectedRequest(null);
      }
    } catch {
      // Error handling - keep current state
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div>
      {/* Page header with filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Swap Requests
          </h2>
          <p className="text-sm text-gray-500">
            {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({requests.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'warning' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending ({pendingCount})
          </Button>
          <Button
            variant={filter === 'mine' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('mine')}
          >
            My Requests ({myRequestsCount})
          </Button>
        </div>
      </div>

      {/* Manager approval queue */}
      {isManager && pendingCount > 0 && filter !== 'mine' && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-yellow-800">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {requests
                .filter((r) => r.status === 'pending')
                .map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {req.requester?.name || 'Unknown'}
                        </span>
                        <Badge variant="pending">Pending</Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {req.shift
                          ? `${formatShiftDate(req.shift.date)} ${req.shift.start_time}-${req.shift.end_time} (${req.shift.role})`
                          : 'Shift details unavailable'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleAction(req.id, 'deny')}
                        disabled={actionLoading === req.id}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Deny
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All requests list */}
      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No swap requests found.</p>
            {filter !== 'all' && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setFilter('all')}
                className="mt-2"
              >
                View all requests
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Card key={req.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {req.requester?.name || 'Unknown'}
                      </span>
                      <Badge variant={STATUS_BADGE_MAP[req.status]}>
                        {req.status}
                      </Badge>
                      {req.requested_by === currentUserId && (
                        <span className="text-xs text-blue-600 font-medium">(You)</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {req.shift
                        ? `${formatShiftDate(req.shift.date)} | ${req.shift.start_time} - ${req.shift.end_time} | ${req.shift.role} - ${req.shift.department}`
                        : 'Shift details unavailable'}
                    </div>
                    {req.reason && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        Reason: {req.reason}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted {new Date(req.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRequest(req)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {isManager && req.status === 'pending' && (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => handleAction(req.id, 'approve')}
                          disabled={actionLoading === req.id}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleAction(req.id, 'deny')}
                          disabled={actionLoading === req.id}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    {req.requested_by === currentUserId && req.status === 'pending' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAction(req.id, 'cancel')}
                        disabled={actionLoading === req.id}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        {selectedRequest && (
          <DialogContent onClose={() => setSelectedRequest(null)}>
            <DialogHeader>
              <DialogTitle>Swap Request Details</DialogTitle>
              <DialogDescription>
                Request #{selectedRequest.id.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge variant={STATUS_BADGE_MAP[selectedRequest.status]}>
                  {selectedRequest.status}
                </Badge>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700">Shift Information</h4>
                {selectedRequest.shift && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Date</span>
                      <p className="font-medium">{formatShiftDate(selectedRequest.shift.date)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Time</span>
                      <p className="font-medium">
                        {selectedRequest.shift.start_time} - {selectedRequest.shift.end_time}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Role</span>
                      <p className="font-medium">{selectedRequest.shift.role}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Department</span>
                      <p className="font-medium">{selectedRequest.shift.department}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-semibold text-gray-700">Requester</h4>
                {selectedRequest.requester && (
                  <div className="text-sm">
                    <p className="font-medium">{selectedRequest.requester.name}</p>
                    <p className="text-gray-500">{selectedRequest.requester.email}</p>
                    {selectedRequest.requester.department && (
                      <p className="text-gray-500">{selectedRequest.requester.department}</p>
                    )}
                  </div>
                )}
              </div>

              {selectedRequest.reason && (
                <div>
                  <span className="text-sm font-semibold text-gray-700">Reason</span>
                  <p className="text-sm text-gray-600 mt-1">{selectedRequest.reason}</p>
                </div>
              )}

              {selectedRequest.reviewed_at && (
                <div className="text-xs text-gray-400">
                  Reviewed on{' '}
                  {new Date(selectedRequest.reviewed_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>

            <DialogFooter>
              {isManager && selectedRequest.status === 'pending' && (
                <>
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleAction(selectedRequest.id, 'approve')}
                    disabled={actionLoading === selectedRequest.id}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleAction(selectedRequest.id, 'deny')}
                    disabled={actionLoading === selectedRequest.id}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                </>
              )}
              {selectedRequest.requested_by === currentUserId &&
                selectedRequest.status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction(selectedRequest.id, 'cancel')}
                    disabled={actionLoading === selectedRequest.id}
                  >
                    Cancel Request
                  </Button>
                )}
              <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
