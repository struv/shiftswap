import { pgTable, uuid, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { locations } from "./locations";

export const userLocations = pgTable("user_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique("user_locations_user_location_unique").on(table.userId, table.locationId),
]);
