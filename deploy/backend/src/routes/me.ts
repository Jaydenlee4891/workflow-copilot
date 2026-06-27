import { Router } from "express";
import { withTenantContext } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler } from "../httpError.js";

export const meRouter = Router();

meRouter.get("/requests", requireAuth, asyncHandler(async (req, res) => {
  const { userId, tenantId } = req.user!;

  const rows = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT r.id, r.status, r.current_stage_order, w.name AS workflow_name, r.field_values
       FROM requests r
       JOIN workflows w ON w.id = r.workflow_id
       WHERE r.requester_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return result.rows;
  });

  res.json(rows);
}));

/**
 * Pending work for the caller: steps directly assigned to them, plus
 * pooled steps they're eligible to claim. Deliberately restricted to
 * ras.stage_order = r.current_stage_order — a step they're assigned to at
 * a future stage isn't actionable yet, so it shouldn't clutter this list
 * (matches the dashboard mockup, where every item has an immediate
 * Review/Claim action, not a "waiting for your turn" placeholder).
 */
meRouter.get("/approvals", requireAuth, asyncHandler(async (req, res) => {
  const { userId, tenantId } = req.user!;

  const rows = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT ras.id AS step_id, ras.stage_order, ras.assignment_mode, ras.assigned_to,
              r.id AS request_id, w.name AS workflow_name
       FROM request_approval_steps ras
       JOIN requests r ON r.id = ras.request_id
       JOIN workflows w ON w.id = r.workflow_id
       WHERE ras.status = 'pending'
         AND r.status = 'in_review'
         AND ras.stage_order = r.current_stage_order
         AND (
           ras.assigned_to = $1
           OR (
             ras.assignment_mode = 'pooled'
             AND ras.assigned_to IS NULL
             AND EXISTS (
               SELECT 1 FROM workflow_approval_step_assignees wasa
               JOIN workflow_approval_steps was ON was.id = wasa.workflow_approval_step_id
               WHERE was.workflow_id = r.workflow_id
                 AND was.stage_order = ras.stage_order
                 AND was.role_id = ras.role_id
                 AND wasa.user_id = $1
             )
           )
         )
       ORDER BY r.created_at`,
      [userId]
    );
    return result.rows;
  });

  res.json(rows);
}));
