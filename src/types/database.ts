import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  organizations,
  locations,
  users,
  userLocations,
  shifts,
  shiftTemplates,
  templateShifts,
  swapRequests,
  timeOffRequests,
  notifications,
  auditLogs,
} from "@/db/schema";

// Select types (rows returned from queries)
export type Organization = InferSelectModel<typeof organizations>;
export type Location = InferSelectModel<typeof locations>;
export type User = InferSelectModel<typeof users>;
export type UserLocation = InferSelectModel<typeof userLocations>;
export type Shift = InferSelectModel<typeof shifts>;
export type ShiftTemplate = InferSelectModel<typeof shiftTemplates>;
export type TemplateShift = InferSelectModel<typeof templateShifts>;
export type SwapRequest = InferSelectModel<typeof swapRequests>;
export type TimeOffRequest = InferSelectModel<typeof timeOffRequests>;
export type Notification = InferSelectModel<typeof notifications>;
export type AuditLog = InferSelectModel<typeof auditLogs>;

// Insert types (for creating new rows)
export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewLocation = InferInsertModel<typeof locations>;
export type NewUser = InferInsertModel<typeof users>;
export type NewUserLocation = InferInsertModel<typeof userLocations>;
export type NewShift = InferInsertModel<typeof shifts>;
export type NewShiftTemplate = InferInsertModel<typeof shiftTemplates>;
export type NewTemplateShift = InferInsertModel<typeof templateShifts>;
export type NewSwapRequest = InferInsertModel<typeof swapRequests>;
export type NewTimeOffRequest = InferInsertModel<typeof timeOffRequests>;
export type NewNotification = InferInsertModel<typeof notifications>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

// Enum-like types
export type UserRole = "employee" | "manager" | "admin";
export type OrgPlan = "free" | "starter" | "pro" | "enterprise";
export type OrgStatus = "active" | "suspended" | "canceled";
export type UserStatus = "active" | "inactive";
export type RequestStatus = "pending" | "approved" | "denied" | "canceled";
export type SwapRequestStatus = RequestStatus;
export type TimeOffRequestStatus = RequestStatus;
