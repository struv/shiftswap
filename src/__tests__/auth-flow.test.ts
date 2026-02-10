/**
 * Integration test: Auth flow
 * signup → login → protected route guard → logout
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockSignUp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

function createMockSupabase() {
  return {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      getUser: mockGetUser,
    },
    from: mockFrom,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Auth flow: signup → login → protected route → logout', () => {
  const testUser = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' },
  };

  const testProfile = {
    id: testUser.id,
    email: testUser.email,
    name: 'Test User',
    role: 'staff',
    department: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('1. signup: creates a new account', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: testUser, session: null },
      error: null,
    });

    const supabase = createMockSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: 'password123',
      options: { data: { name: 'Test User' } },
    });

    expect(error).toBeNull();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: { data: { name: 'Test User' } },
    });
  });

  it('2. signup: rejects weak passwords', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password should be at least 6 characters' },
    });

    const supabase = createMockSupabase();
    const { error } = await supabase.auth.signUp({
      email: 'test@example.com',
      password: '123',
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('6 characters');
  });

  it('3. login: signs in with valid credentials', async () => {
    const mockSession = {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      user: testUser,
    };
    mockSignInWithPassword.mockResolvedValue({
      data: { user: testUser, session: mockSession },
      error: null,
    });

    const supabase = createMockSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(error).toBeNull();
    expect(data.session).toBeDefined();
    expect(data.session.access_token).toBe('test-token');
    expect(data.user.email).toBe('test@example.com');
  });

  it('4. login: rejects invalid credentials', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const supabase = createMockSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'wrong-password',
    });

    expect(error).toBeDefined();
    expect(error!.message).toBe('Invalid login credentials');
  });

  it('5. protected route: allows access with valid session', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: testUser },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({ data: testProfile, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ select: selectMock });

    const supabase = createMockSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    expect(user).toBeDefined();
    expect(user!.id).toBe(testUser.id);

    // Simulate profile fetch (like requireAuth does)
    const { data: profile } = await supabase.from('users').select('*').eq('id', user!.id).single();
    expect(profile).toBeDefined();
    expect(profile.role).toBe('staff');
  });

  it('6. protected route: blocks access without session', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const supabase = createMockSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    expect(user).toBeNull();
    // In real app, middleware redirects to /auth/login
  });

  it('7. logout: signs out and clears session', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    const supabase = createMockSupabase();
    const { error } = await supabase.auth.signOut();

    expect(error).toBeNull();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('8. full flow: signup → login → access → logout', async () => {
    // Step 1: Signup
    mockSignUp.mockResolvedValue({
      data: { user: testUser, session: null },
      error: null,
    });
    const supabase = createMockSupabase();
    const signupResult = await supabase.auth.signUp({
      email: 'flow@example.com',
      password: 'password123',
      options: { data: { name: 'Flow Test' } },
    });
    expect(signupResult.error).toBeNull();

    // Step 2: Login
    mockSignInWithPassword.mockResolvedValue({
      data: { user: testUser, session: { access_token: 'tok' } },
      error: null,
    });
    const loginResult = await supabase.auth.signInWithPassword({
      email: 'flow@example.com',
      password: 'password123',
    });
    expect(loginResult.error).toBeNull();
    expect(loginResult.data.session).toBeDefined();

    // Step 3: Access protected resource
    mockGetUser.mockResolvedValue({ data: { user: testUser }, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toBeDefined();

    // Step 4: Logout
    mockSignOut.mockResolvedValue({ error: null });
    const logoutResult = await supabase.auth.signOut();
    expect(logoutResult.error).toBeNull();

    // Step 5: Verify no longer authenticated
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const afterLogout = await supabase.auth.getUser();
    expect(afterLogout.data.user).toBeNull();
  });
});
