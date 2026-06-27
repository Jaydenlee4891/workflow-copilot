import "dotenv/config";
import { platformPool, withTenantContext } from "./db.js";
import { storage } from "./storage.js";

// Change this one value to adjust how long abandoned drafts are kept.
const DRAFT_EXPIRY_DAYS = 30;

/**
 * Deletes draft requests older than DRAFT_EXPIRY_DAYS. Intended to run on
 * a schedule (e.g. a daily system cron calling `npm run cleanup-drafts`).
 * Kept as a plain script rather than an in-process timer so the server
 * has no always-on background machinery.
 *
 * Only 'draft' requests are ever touched — submitted requests
 * (in_review/approved/rejected) are never affected regardless of age.
 *
 * RLS is enabled on `requests` and neither application role bypasses it,
 * so this can't do a single cross-tenant DELETE. Instead it lists tenants
 * (via platformPool, which can read the tenant table) and runs the
 * deletion once per tenant inside that tenant's RLS context — the same
 * withTenantContext mechanism every other tenant-scoped operation uses.
 */
async function cleanup() {
  const tenants = await platformPool.query("SELECT id FROM tenants");
  let totalDeleted = 0;

  for (const { id: tenantId } of tenants.rows) {
    const deleted = await withTenantContext(
      tenantId,
      async (client) => {
        const expired = await client.query(
          `SELECT id FROM requests
           WHERE status = 'draft'
             AND created_at < now() - ($1 || ' days')::interval`,
          [DRAFT_EXPIRY_DAYS]
        );
        if (expired.rows.length === 0) return 0;

        const ids = expired.rows.map((r) => r.id);

        // Remove stored files before deleting the rows that point to them,
        // otherwise the bytes orphan on disk.
        const docs = await client.query(
          "SELECT storage_key FROM request_documents WHERE request_id = ANY($1)",
          [ids]
        );
        for (const doc of docs.rows) {
          if (doc.storage_key) await storage.delete(doc.storage_key);
        }

        // A draft has no approval steps (those are created at submit), but
        // may have documents. Delete children first, then the requests.
        await client.query("DELETE FROM request_documents WHERE request_id = ANY($1)", [ids]);
        await client.query("DELETE FROM request_approval_steps WHERE request_id = ANY($1)", [ids]);
        await client.query("DELETE FROM requests WHERE id = ANY($1)", [ids]);
        return ids.length;
      },
      platformPool
    );
    totalDeleted += deleted;
  }

  console.log(
    totalDeleted === 0
      ? "No expired drafts to clean up."
      : `Deleted ${totalDeleted} expired draft(s) (older than ${DRAFT_EXPIRY_DAYS} days).`
  );
}

cleanup()
  .then(() => platformPool.end())
  .catch((err) => {
    console.error("Draft cleanup failed:", err);
    process.exit(1);
  });

