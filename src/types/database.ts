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

export type SwapRequestStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

export interface SwapRequest {
  id: string;
  shift_id: string;
  requester_id: string;
  replacement_user_id: string | null;
  notes: string | null;
  reason: string | null;
  status: SwapRequestStatus;
  created_at: string;
  updated_at: string;
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

// Database schema type for Supabase client
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: {
          id: string;
          email: string;
          name: string;
          phone?: string | null;
          role?: string;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          phone?: string | null;
          role?: string;
          department?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: Shift;
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          start_time: string;
          end_time: string;
          role: string;
          department: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          start_time?: string;
          end_time?: string;
          role?: string;
          department?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      callouts: {
        Row: CallOut;
        Insert: {
          id?: string;
          shift_id: string;
          user_id: string;
          reason?: string | null;
          posted_at?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          user_id?: string;
          reason?: string | null;
          posted_at?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      claims: {
        Row: Claim;
        Insert: {
          id?: string;
          callout_id: string;
          user_id: string;
          claimed_at?: string;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          callout_id?: string;
          user_id?: string;
          claimed_at?: string;
          status?: string;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      swap_requests: {
        Row: SwapRequest;
        Insert: {
          id?: string;
          shift_id: string;
          requester_id: string;
          replacement_user_id?: string | null;
          notes?: string | null;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          requester_id?: string;
          replacement_user_id?: string | null;
          notes?: string | null;
          reason?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
