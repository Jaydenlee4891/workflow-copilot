import { Pool, PoolClient } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Connects as platform_admin_user, not app_user — see schema.sql. Used
// only by platform-staff (onboarding) routes.
export const platformPool = new Pool({
  connectionString: process.env.PLATFORM_DATABASE_URL,
});

/**
 * Runs `fn` with a client whose Postgres session has app.current_tenant_id
 * set for the duration of one transaction, so every row-level security
 * policy scopes its queries to that tenant. The client is always released
 * back to the pool afterward, success or failure.
 *
 * Deliberately uses the set_config() SQL function, not the `SET LOCAL`
 * command, even though it reads similarly: `SET` does not accept bind
 * parameters ($1), so the only injection-safe way to pass a dynamic value
 * into a session setting from application code is via set_config(), which
 * is a regular function call and takes parameters normally. Its third
 * argument (`true`) makes the setting transaction-local, equivalent to
 * `SET LOCAL`.
 *
 * Accepts which pool to connect through (default: app_user). Onboarding
 * routes pass `platformPool` — they're still tenant-scoped operations
 * (creating data FOR a specific tenant), so the same RLS mechanism
 * applies regardless of which role is connecting.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (client: PoolClient) => Promise<T>,
  usePool: Pool = pool
): Promise<T> {
  const client = await usePool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * For queries that aren't tenant-scoped at all — currently just resolving
 * a platform-admin login against platform_admins, which has no tenant_id
 * and no RLS (see schema.sql).
 */
export async function withPlatformContext<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await platformPool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
