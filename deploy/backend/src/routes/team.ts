import { Router } from "express";
import { withTenantContext } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, HttpError } from "../httpError.js";

export const teamRouter = Router();

// All endpoints require authentication. PATCH also requires tenant admin — checked inline.

// GET /team/roster
// Returns all workflows with their approval steps and current assignees.
// Shape consumed by RosterPage: workflows[].steps[].assignees[].email
teamRouter.get("/roster", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId } = req.user!;

  const rows = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT
         w.id AS workflow_id,
         w.name AS workflow_name,
         was.id AS step_id,
         was.stage_order,
         was.assignment_mode,
         r.name AS role_name,
         COALESCE(
           json_agg(
             json_build_object('userId', u.id, 'email', u.email)
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'
         ) AS assignees
       FROM workflows w
       JOIN workflow_approval_steps was ON was.workflow_id = w.id
       JOIN roles r ON r.id = was.role_id
       LEFT JOIN workflow_approval_step_assignees wasa ON wasa.workflow_approval_step_id = was.id
       LEFT JOIN users u ON u.id = wasa.user_id AND u.is_active = true
       WHERE w.is_active = true
       GROUP BY w.id, w.name, was.id, was.stage_order, was.assignment_mode, r.name
       ORDER BY w.name, was.stage_order`
    );

    // Group flat rows into workflows → steps
    const workflowMap = new Map<string, { workflowId: string; workflowName: string; steps: any[] }>();
    for (const row of result.rows) {
      if (!workflowMap.has(row.workflow_id)) {
        workflowMap.set(row.workflow_id, { workflowId: row.workflow_id, workflowName: row.workflow_name, steps: [] });
      }
      workflowMap.get(row.workflow_id)!.steps.push({
        stepId: row.step_id,
        stageOrder: row.stage_order,
        assignmentMode: row.assignment_mode,
        roleName: row.role_name,
        assignees: row.assignees,
      });
    }
    return [...workflowMap.values()];
  });

  res.json(rows);
}));

// PATCH /team/roster/steps/:stepId/assignees
// Full replace: delete all existing assignees for this step, insert new ones.
// Requires tenant admin.
teamRouter.patch("/roster/steps/:stepId/assignees", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId, isTenantAdmin } = req.user!;
  if (!isTenantAdmin) throw new HttpError(403, "Only a tenant admin can update assignments");

  const { userIds } = req.body ?? {};
  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds (array) is required" });
  }

  await withTenantContext(tenantId, async (client) => {
    // Confirm the step belongs to this tenant before touching it.
    const check = await client.query(
      `SELECT was.id FROM workflow_approval_steps was
       JOIN workflows w ON w.id = was.workflow_id
       WHERE was.id = $1`,
      [req.params.stepId]
    );
    if (!check.rows[0]) throw new HttpError(404, "Approval step not found");

    await client.query(
      "DELETE FROM workflow_approval_step_assignees WHERE workflow_approval_step_id = $1",
      [req.params.stepId]
    );
    for (const userId of userIds as string[]) {
      await client.query(
        "INSERT INTO workflow_approval_step_assignees (workflow_approval_step_id, user_id) VALUES ($1, $2)",
        [req.params.stepId, userId]
      );
    }
  });

  res.json({ updated: true });
}));

// GET /team/users
// Lists active and departed users for the tenant.
// Used by: assignee picker (filter to is_active=true client-side), UsersPage (show all).
teamRouter.get("/users", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId } = req.user!;

  const rows = await withTenantContext(tenantId, async (client) => {
    const result = await client.query(
      `SELECT u.id, u.email, u.is_active, u.is_tenant_admin, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.is_active DESC, u.email`
    );
    return result.rows;
  });

  res.json(rows);
}));
