import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const orgPlanEnum = pgEnum('org_plan', ['free', 'pro', 'enterprise']);
export const orgStatusEnum = pgEnum('org_status', ['active', 'suspended']);
export const memberRoleEnum = pgEnum('member_role', ['admin', 'manager', 'staff']);
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'invited']);
export const swapStatusEnum = pgEnum('swap_status', [
  'pending',
  'approved',
  'denied',
  'canceled',
]);
export const notificationTypeEnum = pgEnum('notification_type', [
  'swap_requested',
  'swap_approved',
  'swap_denied',
  'shift_assigned',
  'shift_updated',
  'general',
]);

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  settings: jsonb('settings').default({}),
  plan: orgPlanEnum('plan').notNull().default('free'),
  status: orgStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Org Members — membership / role assignment
// ---------------------------------------------------------------------------

export const orgMembers = pgTable(
  'org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(), // references auth.users(id) — enforced in SQL
    role: memberRoleEnum('role').notNull().default('staff'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_org_members_user_org').on(table.userId, table.orgId),
    index('idx_org_members_org_id').on(table.orgId),
  ],
);

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
    timezone: text('timezone').notNull().default('America/New_York'),
    settings: jsonb('settings').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_locations_org_id').on(table.orgId)],
);

// ---------------------------------------------------------------------------
// Users — profile data (linked to Supabase auth.users via id)
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(), // set to auth.users.id; FK enforced in SQL
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    role: memberRoleEnum('role').notNull().default('staff'),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_users_org_email').on(table.orgId, table.email),
    index('idx_users_org_id').on(table.orgId),
  ],
);

// ---------------------------------------------------------------------------
// User ↔ Location join table
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
    uniqueIndex('uq_user_locations_user_location').on(table.userId, table.locationId),
    index('idx_user_locations_org_id').on(table.orgId),
  ],
);

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
    index('idx_shifts_org_id').on(table.orgId),
  ],
);

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
    status: swapStatusEnum('status').notNull().default('pending'),
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
    index('idx_swap_requests_org_id').on(table.orgId),
  ],
);

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
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    link: text('link'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user_unread').on(table.userId, table.readAt),
    index('idx_notifications_org_id').on(table.orgId),
  ],
);
