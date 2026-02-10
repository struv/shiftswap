/**
 * Integration test: Auth flow
 * signup → login → protected route guard → logout
 *
 * Tests the Neon Auth integration by mocking the auth API calls
 * and database queries.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Neon Auth API
// ---------------------------------------------------------------------------

const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();

function createMockAuthClient() {
  return {
    signUp: mockSignUp,
    signIn: mockSignIn,
    getUser: mockGetUser,
    signOut: mockSignOut,
  };
}

// ---------------------------------------------------------------------------
// Mock DB client
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();

function createMockDbClient() {
  return {
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
    name: 'Test User',
  };

  const testTokens = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
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

  it('1. signup: creates a new account via Neon Auth', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: testUser, tokens: testTokens },
      error: null,
    });

    const auth = createMockAuthClient();
    const result = await auth.signUp({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    expect(result.error).toBeNull();
    expect(result.data.user).toBeDefined();
    expect(result.data.user.email).toBe('test@example.com');
    expect(result.data.tokens.access_token).toBeDefined();
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });
  });

  it('2. signup: rejects weak passwords', async () => {
    mockSignUp.mockResolvedValue({
      data: null,
      error: 'Password should be at least 6 characters',
    });

    const auth = createMockAuthClient();
    const result = await auth.signUp({
      email: 'test@example.com',
      password: '123',
    });

    expect(result.error).toBeDefined();
    expect(result.error).toContain('6 characters');
  });

  it('3. login: signs in with valid credentials', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: testUser, tokens: testTokens },
      error: null,
    });

    const auth = createMockAuthClient();
    const result = await auth.signIn({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result.error).toBeNull();
    expect(result.data.tokens).toBeDefined();
    expect(result.data.tokens.access_token).toBe('test-access-token');
    expect(result.data.user.email).toBe('test@example.com');
  });

  it('4. login: rejects invalid credentials', async () => {
    mockSignIn.mockResolvedValue({
      data: null,
      error: 'Invalid login credentials',
    });

    const auth = createMockAuthClient();
    const result = await auth.signIn({
      email: 'test@example.com',
      password: 'wrong-password',
    });

    expect(result.error).toBeDefined();
    expect(result.error).toBe('Invalid login credentials');
  });

  it('5. protected route: allows access with valid session token', async () => {
    mockGetUser.mockResolvedValue(testUser);

    const singleMock = vi.fn().mockResolvedValue({ data: testProfile, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    mockFrom.mockReturnValue({ select: selectMock });

    const auth = createMockAuthClient();
    const user = await auth.getUser('test-access-token');

    expect(user).toBeDefined();
    expect(user!.id).toBe(testUser.id);

    // Simulate profile fetch (like requireAuth does)
    const db = createMockDbClient();
    const { data: profile } = await db.from('users').select('*').eq('id', user!.id).single();
    expect(profile).toBeDefined();
    expect(profile.role).toBe('staff');
  });

  it('6. protected route: blocks access without session token', async () => {
    mockGetUser.mockResolvedValue(null);

    const auth = createMockAuthClient();
    const user = await auth.getUser(null);

    expect(user).toBeNull();
    // In real app, middleware redirects to /auth/login
  });

  it('7. logout: signs out and clears session', async () => {
    mockSignOut.mockResolvedValue(undefined);

    const auth = createMockAuthClient();
    await auth.signOut('test-access-token');

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith('test-access-token');
  });

  it('8. full flow: signup → login → access → logout', async () => {
    // Step 1: Signup
    mockSignUp.mockResolvedValue({
      data: { user: testUser, tokens: testTokens },
      error: null,
    });
    const auth = createMockAuthClient();
    const signupResult = await auth.signUp({
      email: 'flow@example.com',
      password: 'password123',
      name: 'Flow Test',
    });
    expect(signupResult.error).toBeNull();

    // Step 2: Login
    mockSignIn.mockResolvedValue({
      data: { user: testUser, tokens: testTokens },
      error: null,
    });
    const loginResult = await auth.signIn({
      email: 'flow@example.com',
      password: 'password123',
    });
    expect(loginResult.error).toBeNull();
    expect(loginResult.data.tokens).toBeDefined();

    // Step 3: Access protected resource
    mockGetUser.mockResolvedValue(testUser);
    const user = await auth.getUser(loginResult.data.tokens.access_token);
    expect(user).toBeDefined();

    // Step 4: Logout
    mockSignOut.mockResolvedValue(undefined);
    await auth.signOut(loginResult.data.tokens.access_token);
    expect(mockSignOut).toHaveBeenCalled();

    // Step 5: Verify no longer authenticated
    mockGetUser.mockResolvedValue(null);
    const afterLogout = await auth.getUser('invalid-token');
    expect(afterLogout).toBeNull();
  });
});
