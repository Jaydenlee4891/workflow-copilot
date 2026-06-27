import { Router } from "express";
import { pool, withTenantContext } from "../db.js";
import { verifyPassword, signToken } from "../auth.js";
import { asyncHandler } from "../httpError.js";

export const authRouter = Router();

/**
 * Login requires tenantId explicitly, rather than resolving it from email
 * alone. users.email is only unique per tenant (UNIQUE (tenant_id, email)),
 * so the same email could exist in more than one tenant — and querying
 * `users` at all requires app.current_tenant_id to already be set, since
 * RLS is enabled on it. That's a real chicken-and-egg: you need a tenant
 * to query users, but normally you'd query users to find the tenant.
 *
 * `tenants` deliberately has no RLS (see schema.sql), so it's safe to look
 * up before any tenant context exists. Requiring the client to already
 * know its tenantId sidesteps the problem for this pass, but pushes a real
 * open question up to the frontend: how does a login screen know which
 * tenant it's logging into in the first place — subdomain, a slug in the
 * URL, an org picker? Not resolved yet; flagging rather than guessing.
 */
authRouter.post("/login", asyncHandler(async (req, res) => {
  const { tenantId, email, password } = req.body ?? {};
  if (!tenantId || !email || !password) {
    return res.status(400).json({ error: "tenantId, email, and password are required" });
  }

  const tenantResult = await pool.query(
    "SELECT id, auth_method FROM tenants WHERE id = $1",
    [tenantId]
  );
  const tenant = tenantResult.rows[0];
  if (!tenant) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (tenant.auth_method !== "password") {
    return res.status(400).json({ error: `This tenant uses ${tenant.auth_method} authentication, not password login` });
  }

  const user = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      "SELECT id, password_hash, is_tenant_admin, is_active FROM users WHERE email = $1",
      [email]
    );
    return result.rows[0];
  });

  if (!user || !user.is_active || !user.password_hash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ userId: user.id, tenantId, isTenantAdmin: user.is_tenant_admin });
  res.json({ token });
}));
