// Database types for ShiftSwap
// These match our Supabase schema

export type UserRole = 'staff' | 'manager' | 'admin';
export type OrgRole = 'admin' | 'manager' | 'staff';
export type OrgPlan = 'free' | 'starter' | 'pro' | 'enterprise';
export type OrgStatus = 'active' | 'suspended' | 'canceled';

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

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  role: string;
  department: string;
  created_at: string;
}

export type CallOutStatus = 'open' | 'claimed' | 'approved' | 'cancelled';

export interface CallOut {
  id: string;
  shift_id: string;
  user_id: string; // who's calling out
  reason: string | null;
  posted_at: string;
  status: CallOutStatus;
  created_at: string;
  updated_at: string;
}

export type SwapRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface SwapRequest {
  id: string;
  shift_id: string;
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

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export interface Claim {
  id: string;
  callout_id: string;
  user_id: string; // who's claiming
  claimed_at: string;
  status: ClaimStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// Session user profile returned by requireAuth()
export interface UserSession {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
}

// Joined types for display
export interface CallOutWithDetails extends CallOut {
  shift: Shift;
  user: User;
  claims?: ClaimWithUser[];
}

export interface ClaimWithUser extends Claim {
  user: User;
}

// Database schema type for Supabase
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
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id'>>;
      };
      shifts: {
        Row: Shift;
        Insert: Omit<Shift, 'id' | 'created_at'>;
        Update: Partial<Omit<Shift, 'id'>>;
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
      swap_requests: {
        Row: SwapRequest;
        Insert: Omit<SwapRequest, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SwapRequest, 'id'>>;
      };
    };
  };
}
