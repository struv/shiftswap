import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export interface TokenPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  type: 'access' | 'refresh';
}

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, type: 'access' } satisfies TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function signRefreshToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, type: 'refresh' } satisfies TokenPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
