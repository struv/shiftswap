-- Performance indexes
CREATE INDEX idx_locations_org ON locations(org_id);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_user_locations_org ON user_locations(org_id);
CREATE INDEX idx_shifts_org_location ON shifts(org_id, location_id);
CREATE INDEX idx_shifts_user_time ON shifts(user_id, start_time);
CREATE INDEX idx_shift_templates_org ON shift_templates(org_id, location_id);
CREATE INDEX idx_template_shifts_template ON template_shifts(template_id);
CREATE INDEX idx_swap_requests_org_status ON swap_requests(org_id, status);
CREATE INDEX idx_swap_requests_requested_by ON swap_requests(requested_by);
CREATE INDEX idx_time_off_requests_org_status ON time_off_requests(org_id, status);
CREATE INDEX idx_time_off_requests_user ON time_off_requests(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_org ON notifications(org_id);
CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with updated_at column
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shift_templates_updated_at
  BEFORE UPDATE ON shift_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swap_requests_updated_at
  BEFORE UPDATE ON swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_off_requests_updated_at
  BEFORE UPDATE ON time_off_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row-Level Security on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_off_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Organization isolation via app.current_org_id session variable
-- The application sets this variable per-request: SET app.current_org_id = '<org-uuid>';

-- Organizations: users can only see their own org
CREATE POLICY org_isolation_select ON organizations
  FOR SELECT USING (id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON organizations
  FOR UPDATE USING (id = current_setting('app.current_org_id', true)::uuid);

-- Locations: scoped to current org
CREATE POLICY org_isolation_select ON locations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON locations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON locations
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Users: scoped to current org
CREATE POLICY org_isolation_select ON users
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON users
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON users
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON users
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- User Locations: scoped to current org
CREATE POLICY org_isolation_select ON user_locations
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON user_locations
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON user_locations
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON user_locations
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shifts: scoped to current org
CREATE POLICY org_isolation_select ON shifts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON shifts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON shifts
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Shift Templates: scoped to current org
CREATE POLICY org_isolation_select ON shift_templates
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON shift_templates
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON shift_templates
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON shift_templates
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Template Shifts: scoped to current org
CREATE POLICY org_isolation_select ON template_shifts
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON template_shifts
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON template_shifts
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON template_shifts
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Swap Requests: scoped to current org
CREATE POLICY org_isolation_select ON swap_requests
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON swap_requests
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON swap_requests
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON swap_requests
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Time Off Requests: scoped to current org
CREATE POLICY org_isolation_select ON time_off_requests
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON time_off_requests
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON time_off_requests
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON time_off_requests
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Notifications: scoped to current org
CREATE POLICY org_isolation_select ON notifications
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON notifications
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_update ON notifications
  FOR UPDATE USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_delete ON notifications
  FOR DELETE USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Audit Logs: scoped to current org (insert + select only, no update/delete for immutability)
CREATE POLICY org_isolation_select ON audit_logs
  FOR SELECT USING (org_id = current_setting('app.current_org_id', true)::uuid);

CREATE POLICY org_isolation_insert ON audit_logs
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id', true)::uuid);
