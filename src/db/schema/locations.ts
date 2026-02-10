import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
