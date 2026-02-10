// Database types for ShiftSwap — derived from Drizzle schema (db/schema.ts)
// These types are used across the application for type safety.

import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  organizations,
  orgMembers,
  locations,
  users,
  userLocations,
  shifts,
  swapRequests,
  notifications,
} from '../../db/schema';

// ---------------------------------------------------------------------------
// Row types (SELECT)
// ---------------------------------------------------------------------------

export type Organization = InferSelectModel<typeof organizations>;
export type OrgMember = InferSelectModel<typeof orgMembers>;
export type Location = InferSelectModel<typeof locations>;
export type User = InferSelectModel<typeof users>;
export type UserLocation = InferSelectModel<typeof userLocations>;
export type Shift = InferSelectModel<typeof shifts>;
export type SwapRequest = InferSelectModel<typeof swapRequests>;
export type Notification = InferSelectModel<typeof notifications>;

// ---------------------------------------------------------------------------
// Insert types
// ---------------------------------------------------------------------------

export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewOrgMember = InferInsertModel<typeof orgMembers>;
export type NewLocation = InferInsertModel<typeof locations>;
export type NewUser = InferInsertModel<typeof users>;
export type NewUserLocation = InferInsertModel<typeof userLocations>;
export type NewShift = InferInsertModel<typeof shifts>;
export type NewSwapRequest = InferInsertModel<typeof swapRequests>;
export type NewNotification = InferInsertModel<typeof notifications>;

// ---------------------------------------------------------------------------
// Enum value types (for use in application code)
// ---------------------------------------------------------------------------

export type OrgPlan = 'free' | 'pro' | 'enterprise';
export type OrgStatus = 'active' | 'suspended';
export type MemberRole = 'admin' | 'manager' | 'staff';
export type UserStatus = 'active' | 'inactive' | 'invited';
export type SwapStatus = 'pending' | 'approved' | 'denied' | 'canceled';
export type NotificationType =
  | 'swap_requested'
  | 'swap_approved'
  | 'swap_denied'
  | 'shift_assigned'
  | 'shift_updated'
  | 'general';

// ---------------------------------------------------------------------------
// Session / Auth types
// ---------------------------------------------------------------------------

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: MemberRole;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Joined / display types
// ---------------------------------------------------------------------------

export interface ShiftWithDetails extends Shift {
  user: User;
  location: Location;
}

export interface SwapRequestWithDetails extends SwapRequest {
  originalShift: ShiftWithDetails;
  requestedByUser: User;
  replacementUser: User | null;
  reviewedByUser: User | null;
}
