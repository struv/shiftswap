/**
 * Drizzle ORM schema for ShiftSwap.
 *
 * Every table includes `org_id` for Row-Level Security (RLS) isolation.
 * PostgreSQL RLS policies use `current_setting('app.current_org_id', true)::uuid`
 * to enforce multi-tenant data access.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  time,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  settings: jsonb('settings').default({}),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  locations: many(locations),
  users: many(users),
}));

// ---------------------------------------------------------------------------
// Org Members (maps users to organizations with roles)
// ---------------------------------------------------------------------------

export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('staff'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('org_members_org_user_unique').on(table.orgId, table.userId),
  ],
);

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Locations (clinics / offices within an org)
// ---------------------------------------------------------------------------

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    timezone: text('timezone').notNull().default('America/Los_Angeles'),
    settings: jsonb('settings').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_locations_org').on(table.orgId),
  ],
);

export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.orgId],
    references: [organizations.id],
  }),
  shifts: many(shifts),
  userLocations: many(userLocations),
  shiftTemplates: many(shiftTemplates),
}));

// ---------------------------------------------------------------------------
// Users (employees, managers, admins)
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    role: text('role').notNull().default('employee'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_org_email_unique').on(table.orgId, table.email),
    index('idx_users_org').on(table.orgId),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  orgMemberships: many(orgMembers),
  userLocations: many(userLocations),
  shifts: many(shifts),
  swapRequestsCreated: many(swapRequests, { relationName: 'requester' }),
  swapRequestsReplacement: many(swapRequests, { relationName: 'replacement' }),
  swapRequestsReviewed: many(swapRequests, { relationName: 'reviewer' }),
  notifications: many(notifications),
}));

// ---------------------------------------------------------------------------
// User Locations (employees can work at multiple locations)
// ---------------------------------------------------------------------------

export const userLocations = pgTable(
  'user_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_locations_user_location_unique').on(table.userId, table.locationId),
    index('idx_user_locations_org').on(table.orgId),
  ],
);

export const userLocationsRelations = relations(userLocations, ({ one }) => ({
  organization: one(organizations, {
    fields: [userLocations.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [userLocations.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [userLocations.locationId],
    references: [locations.id],
  }),
}));

// ---------------------------------------------------------------------------
// Shifts
// ---------------------------------------------------------------------------

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    role: text('role'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_shifts_org_location').on(table.orgId, table.locationId),
    index('idx_shifts_user_time').on(table.userId, table.startTime),
  ],
);

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [shifts.orgId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [shifts.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
  swapRequests: many(swapRequests),
}));

// ---------------------------------------------------------------------------
// Shift Templates (recurring weekly schedules)
// ---------------------------------------------------------------------------

export const shiftTemplates = pgTable(
  'shift_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_shift_templates_org').on(table.orgId),
  ],
);

export const shiftTemplatesRelations = relations(shiftTemplates, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [shiftTemplates.orgId],
    references: [organizations.id],
  }),
  location: one(locations, {
    fields: [shiftTemplates.locationId],
    references: [locations.id],
  }),
  templateShifts: many(templateShifts),
}));

// ---------------------------------------------------------------------------
// Template Shifts (individual shift definitions within a template)
// ---------------------------------------------------------------------------

export const templateShifts = pgTable(
  'template_shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id')
      .notNull()
      .references(() => shiftTemplates.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 6 = Saturday
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    role: text('role'),
    notes: text('notes'),
  },
  (table) => [
    index('idx_template_shifts_template').on(table.templateId),
  ],
);

export const templateShiftsRelations = relations(templateShifts, ({ one }) => ({
  organization: one(organizations, {
    fields: [templateShifts.orgId],
    references: [organizations.id],
  }),
  template: one(shiftTemplates, {
    fields: [templateShifts.templateId],
    references: [shiftTemplates.id],
  }),
}));

// ---------------------------------------------------------------------------
// Swap Requests
// ---------------------------------------------------------------------------

export const swapRequests = pgTable(
  'swap_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    originalShiftId: uuid('original_shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    replacementUserId: uuid('replacement_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    status: text('status').notNull().default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    managerNotes: text('manager_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_swap_requests_org_status').on(table.orgId, table.status),
    index('idx_swap_requests_shift').on(table.originalShiftId),
  ],
);

export const swapRequestsRelations = relations(swapRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [swapRequests.orgId],
    references: [organizations.id],
  }),
  originalShift: one(shifts, {
    fields: [swapRequests.originalShiftId],
    references: [shifts.id],
  }),
  requester: one(users, {
    fields: [swapRequests.requestedBy],
    references: [users.id],
    relationName: 'requester',
  }),
  replacement: one(users, {
    fields: [swapRequests.replacementUserId],
    references: [users.id],
    relationName: 'replacement',
  }),
  reviewer: one(users, {
    fields: [swapRequests.reviewedBy],
    references: [users.id],
    relationName: 'reviewer',
  }),
}));

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    link: text('link'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user_unread').on(table.userId, table.readAt),
    index('idx_notifications_org').on(table.orgId),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Audit Logs (immutable)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_logs_org').on(table.orgId),
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
  ],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
