// Database types for ShiftSwap
// These match the Drizzle schema in src/lib/schema.ts

// ---------------------------------------------------------------------------
// Enums / union types
// ---------------------------------------------------------------------------

export type UserRole = 'employee' | 'manager' | 'admin';
export type OrgRole = 'admin' | 'manager' | 'staff';
export type OrgPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrgStatus = 'active' | 'suspended' | 'canceled';
export type UserStatus = 'active' | 'inactive';
export type SwapRequestStatus = 'pending' | 'approved' | 'denied' | 'canceled';
export type CallOutStatus = 'open' | 'claimed' | 'approved' | 'cancelled';
export type ClaimStatus = 'pending' | 'approved' | 'rejected';

// ---------------------------------------------------------------------------
// Table row types
// ---------------------------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  plan: OrgPlan;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
}

export interface Location {
  id: string;
  org_id: string;
  name: string;
  address: string | null;
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface UserLocation {
  id: string;
  org_id: string;
  user_id: string;
  location_id: string;
  is_primary: boolean;
  created_at: string;
}

export interface Shift {
  id: string;
  org_id: string;
  location_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftTemplate {
  id: string;
  org_id: string;
  location_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateShift {
  id: string;
  org_id: string;
  template_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  role: string | null;
  notes: string | null;
}

export interface SwapRequest {
  id: string;
  org_id: string;
  original_shift_id: string;
  requested_by: string;
  replacement_user_id: string | null;
  reason: string | null;
  status: SwapRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  org_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read_at: string | null;
  link: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Legacy types (from migration 001, kept for backward compatibility)

export interface CallOut {
  id: string;
  org_id: string;
  shift_id: string;
  user_id: string;
  reason: string | null;
  posted_at: string;
  status: CallOutStatus;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  org_id: string;
  callout_id: string;
  user_id: string;
  claimed_at: string;
  status: ClaimStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Joined / display types
// ---------------------------------------------------------------------------

export interface SwapRequestWithDetails extends SwapRequest {
  original_shift: Shift;
  requester: User;
  replacement: User | null;
  reviewer: User | null;
}

export interface ShiftWithDetails extends Shift {
  user: User;
  location: Location;
}

// ---------------------------------------------------------------------------
// Database schema type (for Supabase client compatibility)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Organization, 'id'>>;
      };
      org_members: {
        Row: OrgMember;
        Insert: Omit<OrgMember, 'id' | 'joined_at'>;
        Update: Partial<Omit<OrgMember, 'id'>>;
      };
      locations: {
        Row: Location;
        Insert: Omit<Location, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Location, 'id'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id'>>;
      };
      user_locations: {
        Row: UserLocation;
        Insert: Omit<UserLocation, 'id' | 'created_at'>;
        Update: Partial<Omit<UserLocation, 'id'>>;
      };
      shifts: {
        Row: Shift;
        Insert: Omit<Shift, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Shift, 'id'>>;
      };
      shift_templates: {
        Row: ShiftTemplate;
        Insert: Omit<ShiftTemplate, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ShiftTemplate, 'id'>>;
      };
      template_shifts: {
        Row: TemplateShift;
        Insert: Omit<TemplateShift, 'id'>;
        Update: Partial<Omit<TemplateShift, 'id'>>;
      };
      swap_requests: {
        Row: SwapRequest;
        Insert: Omit<SwapRequest, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SwapRequest, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at'>;
        Update: Partial<Omit<Notification, 'id'>>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, 'id' | 'created_at'>;
        Update: never;
      };
      callouts: {
        Row: CallOut;
        Insert: Omit<CallOut, 'id' | 'created_at' | 'updated_at' | 'posted_at'>;
        Update: Partial<Omit<CallOut, 'id'>>;
      };
      claims: {
        Row: Claim;
        Insert: Omit<Claim, 'id' | 'created_at' | 'claimed_at'>;
        Update: Partial<Omit<Claim, 'id'>>;
      };
    };
  };
}
