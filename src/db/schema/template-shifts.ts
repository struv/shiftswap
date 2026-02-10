import { pgTable, uuid, integer, time, text } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { shiftTemplates } from "./shift-templates";

export const templateShifts = pgTable("template_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  templateId: uuid("template_id").notNull().references(() => shiftTemplates.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  role: text("role"),
  notes: text("notes"),
});
