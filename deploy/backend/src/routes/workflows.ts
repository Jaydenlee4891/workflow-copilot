import { Router } from "express";
import { withTenantContext } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, HttpError } from "../httpError.js";

export const workflowsRouter = Router();

// List — just enough for service cards on the dashboard.
workflowsRouter.get("/", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId } = req.user!;
  const rows = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      "SELECT id, name, description FROM workflows WHERE is_active = true ORDER BY name"
    );
    return result.rows;
  });
  res.json(rows);
}));

// Detail — full definition needed to render the dynamic form + checklist.
workflowsRouter.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId } = req.user!;
  const workflow = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      "SELECT id, name, description, fields, required_documents FROM workflows WHERE id = $1 AND is_active = true",
      [req.params.id]
    );
    return result.rows[0] ?? null;
  });
  if (!workflow) throw new HttpError(404, "Workflow not found");
  res.json(workflow);
}));
