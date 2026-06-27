import { Router } from "express";
import { platformPool, withTenantContext } from "../db.js";
import { requirePlatformAuth } from "../middleware/requirePlatformAuth.js";
import { hashPassword } from "../auth.js";
import { asyncHandler } from "../httpError.js";

export const adminTenantsRouter = Router();
adminTenantsRouter.use(requirePlatformAuth);

// ---------- tenants ----------

adminTenantsRouter.get("/", asyncHandler(async (_req, res) => {
  // tenants itself has no RLS, so this part is a plain unscoped query —
  // but workflows/users DO have RLS, which is inherently a
  // single-tenant-at-a-time model. A query trying to count them across
  // every tenant at once can't work against that (Postgres correctly
  // refused it, since app.current_tenant_id was never set for an
  // unscoped connection — the same fail-closed property proven during
  // the database step, just surfaced here as a query I wrote wrong).
  // Counting per tenant through the normal scoped mechanism instead.
  const tenantsResult = await platformPool.query(
    "SELECT id, name, status, auth_method FROM tenants ORDER BY created_at DESC"
  );

  const withCounts = await Promise.all(
    tenantsResult.rows.map(async (tenant) => {
      const counts = await withTenantContext(
        tenant.id,
        async (client) => {
          const result = await client.query(
            `SELECT
               (SELECT count(*) FROM workflows) AS workflow_count,
               (SELECT count(*) FROM users) AS user_count`
          );
          return result.rows[0];
        },
        platformPool
      );
      return { ...tenant, ...counts };
    })
  );

  res.json(withCounts);
}));

adminTenantsRouter.post("/", asyncHandler(async (req, res) => {
  const { name, authMethod, notificationChannel, notificationConfig } = req.body ?? {};
  if (!name || !authMethod) {
    return res.status(400).json({ error: "name and authMethod are required" });
  }
  const result = await platformPool.query(
    `INSERT INTO tenants (name, auth_method, notification_channel, notification_config, status, created_by)
     VALUES ($1, $2, $3, $4, 'onboarding', $5) RETURNING id`,
    [name, authMethod, notificationChannel ?? "email", notificationConfig ?? null, req.platformAdmin!.platformAdminId]
  );
  res.status(201).json({ id: result.rows[0].id });
}));

adminTenantsRouter.get("/:tenantId", asyncHandler(async (req, res) => {
  const result = await platformPool.query(
    "SELECT id, name, status, auth_method, notification_channel, notification_config FROM tenants WHERE id = $1",
    [req.params.tenantId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Tenant not found" });
  res.json(result.rows[0]);
}));

// ---------- roles ----------

adminTenantsRouter.get("/:tenantId/roles", asyncHandler(async (req, res) => {
  const rows = await withTenantContext(
    req.params.tenantId,
    async (client) => (await client.query("SELECT id, name, hierarchy_level FROM roles ORDER BY hierarchy_level")).rows,
    platformPool
  );
  res.json(rows);
}));

adminTenantsRouter.post("/:tenantId/roles", asyncHandler(async (req, res) => {
  const { name, hierarchyLevel } = req.body ?? {};
  if (!name || hierarchyLevel === undefined) {
    return res.status(400).json({ error: "name and hierarchyLevel are required" });
  }
  const id = await withTenantContext(
    req.params.tenantId,
    async (client) => {
      const result = await client.query(
        "INSERT INTO roles (tenant_id, name, hierarchy_level) VALUES ($1, $2, $3) RETURNING id",
        [req.params.tenantId, name, hierarchyLevel]
      );
      return result.rows[0].id;
    },
    platformPool
  );
  res.status(201).json({ id });
}));

// ---------- users ----------

adminTenantsRouter.get("/:tenantId/users", asyncHandler(async (req, res) => {
  const rows = await withTenantContext(
    req.params.tenantId,
    async (client) =>
      (await client.query("SELECT id, email, role_id, is_tenant_admin, is_active FROM users ORDER BY email")).rows,
    platformPool
  );
  res.json(rows);
}));

adminTenantsRouter.post("/:tenantId/users", asyncHandler(async (req, res) => {
  const { email, password, cacId, roleId, isTenantAdmin } = req.body ?? {};
  if (!email) return res.status(400).json({ error: "email is required" });

  const id = await withTenantContext(
    req.params.tenantId,
    async (client) => {
      const passwordHash = password ? await hashPassword(password) : null;
      const result = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, cac_id, role_id, is_tenant_admin)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [req.params.tenantId, email, passwordHash, cacId ?? null, roleId ?? null, isTenantAdmin ?? false]
      );
      return result.rows[0].id;
    },
    platformPool
  );
  res.status(201).json({ id });
}));

// ---------- launch ----------
// No readiness validation (e.g. "must have at least one workflow") for
// this pass — deliberately permissive, kept simple rather than guessing
// at what a real launch checklist should require.

adminTenantsRouter.post("/:tenantId/launch", asyncHandler(async (req, res) => {
  const result = await platformPool.query(
    "UPDATE tenants SET status = 'live' WHERE id = $1 RETURNING id",
    [req.params.tenantId]
  );
  if (!result.rows[0]) return res.status(404).json({ error: "Tenant not found" });
  res.json({ status: "live" });
}));
