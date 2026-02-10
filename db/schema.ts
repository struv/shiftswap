import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  date,
  time,
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
  plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] })
    .notNull()
    .default('free'),
  status: text('status', { enum: ['active', 'suspended', 'canceled'] })
    .notNull()
    .default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  locations: many(locations),
  orgMembers: many(orgMembers),
  users: many(users),
  shifts: many(shifts),
  swapRequests: many(swapRequests),
  notifications: many(notifications),
  callouts: many(callouts),
  claims: many(claims),
  userLocations: many(userLocations),
}));

// ---------------------------------------------------------------------------
// Locations
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
    index('idx_locations_org_id').on(table.orgId),
  ],
);

export const locationsRelations = relations(locations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [locations.orgId],
    references: [organizations.id],
  }),
  shifts: many(shifts),
  userLocations: many(userLocations),
}));

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    role: text('role', { enum: ['staff', 'manager', 'admin'] })
      .notNull()
      .default('staff'),
    department: text('department'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_users_org_email').on(table.orgId, table.email),
    index('idx_users_org_id').on(table.orgId),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  orgMemberships: many(orgMembers),
  shifts: many(shifts),
  callouts: many(callouts),
  claims: many(claims),
  swapRequestsMade: many(swapRequests, { relationName: 'requestedBy' }),
  notifications: many(notifications),
  userLocations: many(userLocations),
}));

// ---------------------------------------------------------------------------
// User Locations (many-to-many: users <-> locations)
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
    uniqueIndex('idx_user_locations_unique').on(table.userId, table.locationId),
    index('idx_user_locations_org_id').on(table.orgId),
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
// Org Members (user <-> org role mapping)
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
    role: text('role', { enum: ['admin', 'manager', 'staff'] })
      .notNull()
      .default('staff'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_org_members_unique').on(table.orgId, table.userId),
    index('idx_org_members_user_id').on(table.userId),
    index('idx_org_members_org_id').on(table.orgId),
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
// Shifts
// ---------------------------------------------------------------------------

export const shifts = pgTable(
  'shifts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => locations.id, {
      onDelete: 'set null',
    }),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    role: text('role').notNull(),
    department: text('department').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_shifts_org_id').on(table.orgId),
    index('idx_shifts_user_id').on(table.userId),
    index('idx_shifts_date').on(table.date),
    index('idx_shifts_org_location').on(table.orgId, table.locationId),
  ],
);

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [shifts.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [shifts.userId],
    references: [users.id],
  }),
  location: one(locations, {
    fields: [shifts.locationId],
    references: [locations.id],
  }),
  callouts: many(callouts),
  swapRequests: many(swapRequests),
}));

// ---------------------------------------------------------------------------
// Callouts
// ---------------------------------------------------------------------------

export const callouts = pgTable(
  'callouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    postedAt: timestamp('posted_at', { withTimezone: true }).defaultNow(),
    status: text('status', { enum: ['open', 'claimed', 'approved', 'cancelled'] })
      .notNull()
      .default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_callouts_org_id').on(table.orgId),
    index('idx_callouts_status').on(table.status),
    index('idx_callouts_shift_id').on(table.shiftId),
  ],
);

export const calloutsRelations = relations(callouts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [callouts.orgId],
    references: [organizations.id],
  }),
  shift: one(shifts, {
    fields: [callouts.shiftId],
    references: [shifts.id],
  }),
  user: one(users, {
    fields: [callouts.userId],
    references: [users.id],
  }),
  claims: many(claims),
}));

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export const claims = pgTable(
  'claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    calloutId: uuid('callout_id')
      .notNull()
      .references(() => callouts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).defaultNow(),
    status: text('status', { enum: ['pending', 'approved', 'rejected'] })
      .notNull()
      .default('pending'),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_claims_org_id').on(table.orgId),
    index('idx_claims_callout_id').on(table.calloutId),
    index('idx_claims_status').on(table.status),
  ],
);

export const claimsRelations = relations(claims, ({ one }) => ({
  organization: one(organizations, {
    fields: [claims.orgId],
    references: [organizations.id],
  }),
  callout: one(callouts, {
    fields: [claims.calloutId],
    references: [callouts.id],
  }),
  user: one(users, {
    fields: [claims.userId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [claims.approvedBy],
    references: [users.id],
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
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => shifts.id, { onDelete: 'cascade' }),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    replacementUserId: uuid('replacement_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    status: text('status', { enum: ['pending', 'approved', 'denied', 'cancelled'] })
      .notNull()
      .default('pending'),
    reviewedBy: uuid('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    managerNotes: text('manager_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_swap_requests_org_id').on(table.orgId),
    index('idx_swap_requests_shift_id').on(table.shiftId),
    index('idx_swap_requests_requested_by').on(table.requestedBy),
    index('idx_swap_requests_org_status').on(table.orgId, table.status),
  ],
);

export const swapRequestsRelations = relations(swapRequests, ({ one }) => ({
  organization: one(organizations, {
    fields: [swapRequests.orgId],
    references: [organizations.id],
  }),
  shift: one(shifts, {
    fields: [swapRequests.shiftId],
    references: [shifts.id],
  }),
  requester: one(users, {
    fields: [swapRequests.requestedBy],
    references: [users.id],
    relationName: 'requestedBy',
  }),
  replacement: one(users, {
    fields: [swapRequests.replacementUserId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [swapRequests.reviewedBy],
    references: [users.id],
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
    index('idx_notifications_org_id').on(table.orgId),
    index('idx_notifications_user_unread').on(table.userId, table.readAt),
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
