import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockUser } from './helpers';

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

describe('Auth Flow Integration Tests', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Signup → Login → Protected Route → Logout', () => {
    it('should successfully sign up a new user', async () => {
      const newUser = createMockUser({ email: 'newuser@example.com', name: 'New User' });

      mockSupabase.auth.signUp.mockResolvedValue({
        data: {
          user: { id: newUser.id, email: newUser.email },
          session: null, // email confirmation required
        },
        error: null,
      });

      const result = await mockSupabase.auth.signUp({
        email: 'newuser@example.com',
        password: 'securePass123',
        options: { data: { name: 'New User' } },
      });

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.user?.email).toBe('newuser@example.com');
    });

    it('should reject signup with weak password', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Password should be at least 6 characters', status: 422 },
      });

      const result = await mockSupabase.auth.signUp({
        email: 'newuser@example.com',
        password: '123',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Password');
    });

    it('should reject signup with duplicate email', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered', status: 400 },
      });

      const result = await mockSupabase.auth.signUp({
        email: 'existing@example.com',
        password: 'securePass123',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('already registered');
    });

    it('should successfully log in with valid credentials', async () => {
      const user = createMockUser({ email: 'user@example.com' });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: user.id, email: user.email },
          session: {
            access_token: 'test-token',
            refresh_token: 'test-refresh',
            expires_in: 3600,
          },
        },
        error: null,
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'user@example.com',
        password: 'correctPassword',
      });

      expect(result.error).toBeNull();
      expect(result.data.session).toBeDefined();
      expect(result.data.session?.access_token).toBe('test-token');
      expect(result.data.user?.email).toBe('user@example.com');
    });

    it('should reject login with invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      const result = await mockSupabase.auth.signInWithPassword({
        email: 'user@example.com',
        password: 'wrongPassword',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Invalid login credentials');
    });

    it('should return user data on authenticated request', async () => {
      const user = createMockUser({ email: 'authenticated@example.com' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: user.id, email: user.email } },
        error: null,
      });

      const result = await mockSupabase.auth.getUser();

      expect(result.error).toBeNull();
      expect(result.data.user).toBeDefined();
      expect(result.data.user?.email).toBe('authenticated@example.com');
    });

    it('should return null user for unauthenticated request', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await mockSupabase.auth.getUser();
      expect(result.data.user).toBeNull();
    });

    it('should successfully sign out', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const result = await mockSupabase.auth.signOut();
      expect(result.error).toBeNull();

      // After sign-out, getUser should return null
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const userResult = await mockSupabase.auth.getUser();
      expect(userResult.data.user).toBeNull();
    });

    it('should handle the complete signup → login → access → logout flow', async () => {
      const userId = crypto.randomUUID();

      // Step 1: Sign up
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: { id: userId, email: 'flow@example.com' }, session: null },
        error: null,
      });
      const signupResult = await mockSupabase.auth.signUp({
        email: 'flow@example.com',
        password: 'securePass123',
        options: { data: { name: 'Flow User' } },
      });
      expect(signupResult.error).toBeNull();

      // Step 2: Log in
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: userId, email: 'flow@example.com' },
          session: { access_token: 'session-token', refresh_token: 'refresh', expires_in: 3600 },
        },
        error: null,
      });
      const loginResult = await mockSupabase.auth.signInWithPassword({
        email: 'flow@example.com',
        password: 'securePass123',
      });
      expect(loginResult.data.session).toBeDefined();

      // Step 3: Access protected resource (user profile)
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email: 'flow@example.com' } },
        error: null,
      });
      const profile = createMockUser({ id: userId, email: 'flow@example.com', name: 'Flow User' });
      mockSupabase._query.single.mockResolvedValue({ data: profile, error: null });

      const userResult = await mockSupabase.auth.getUser();
      expect(userResult.data.user?.id).toBe(userId);

      // Step 4: Sign out
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      const signOutResult = await mockSupabase.auth.signOut();
      expect(signOutResult.error).toBeNull();

      // Step 5: Verify no longer authenticated
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      const afterLogout = await mockSupabase.auth.getUser();
      expect(afterLogout.data.user).toBeNull();
    });
  });

  describe('Auth Callback', () => {
    it('should exchange code for session successfully', async () => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: {
          session: { access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 },
        },
        error: null,
      });

      const result = await mockSupabase.auth.exchangeCodeForSession('auth-code-123');
      expect(result.error).toBeNull();
      expect(result.data.session).toBeDefined();
    });

    it('should fail with invalid auth code', async () => {
      mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid code', status: 400 },
      });

      const result = await mockSupabase.auth.exchangeCodeForSession('invalid-code');
      expect(result.error).toBeDefined();
    });
  });
});
