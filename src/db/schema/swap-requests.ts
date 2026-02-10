import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { shifts } from "./shifts";
import { users } from "./users";

export const swapRequests = pgTable("swap_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  originalShiftId: uuid("original_shift_id").notNull().references(() => shifts.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  replacementUserId: uuid("replacement_user_id").references(() => users.id, { onDelete: "set null" }),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  managerNotes: text("manager_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
