// Database types for ShiftSwap
// These match our Supabase schema

export type UserRole = 'staff' | 'manager' | 'admin';

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

export type NotificationType =
  | 'swap_request_created'
  | 'swap_request_approved'
  | 'swap_request_denied'
  | 'claim_received'
  | 'general';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
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
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id'>>;
        Relationships: [];
      };
      shifts: {
        Row: Shift;
        Insert: Omit<Shift, 'id' | 'created_at'>;
        Update: Partial<Omit<Shift, 'id'>>;
        Relationships: [];
      };
      callouts: {
        Row: CallOut;
        Insert: Omit<CallOut, 'id' | 'created_at' | 'updated_at' | 'posted_at'>;
        Update: Partial<Omit<CallOut, 'id'>>;
        Relationships: [];
      };
      claims: {
        Row: Claim;
        Insert: Omit<Claim, 'id' | 'created_at' | 'claimed_at'>;
        Update: Partial<Omit<Claim, 'id'>>;
        Relationships: [];
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, 'id' | 'created_at' | 'read_at'> & { read_at?: string | null };
        Update: Partial<Omit<Notification, 'id'>>;
        Relationships: [];
      };
    };
  };
}
