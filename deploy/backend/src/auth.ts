import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AuthTokenPayload {
  userId: string;
  tenantId: string;
  isTenantAdmin: boolean;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

/**
 * Platform-admin tokens are a different shape, not an optional-tenantId
 * variant of AuthTokenPayload: a platform admin isn't a member of any one
 * tenant, so there's no tenantId to carry. Onboarding routes take the
 * tenant being acted on from the URL instead (/admin/tenants/:tenantId/...).
 */
export interface PlatformAuthTokenPayload {
  platformAdminId: string;
}

export function signPlatformToken(payload: PlatformAuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export function verifyPlatformToken(token: string): PlatformAuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as PlatformAuthTokenPayload;
}
