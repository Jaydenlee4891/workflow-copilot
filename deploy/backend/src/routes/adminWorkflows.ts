import { Router } from "express";
import { withTenantContext, platformPool } from "../db.js";
import { requirePlatformAuth } from "../middleware/requirePlatformAuth.js";
import { asyncHandler } from "../httpError.js";

export const adminWorkflowsRouter = Router();
adminWorkflowsRouter.use(requirePlatformAuth);

// ---------- workflows ----------

adminWorkflowsRouter.get("/:tenantId/workflows", asyncHandler(async (req, res) => {
  const rows = await withTenantContext(
    req.params.tenantId,
    async (client) =>
      (await client.query(
        "SELECT id, name, description, fields, required_documents, is_active FROM workflows ORDER BY name"
      )).rows,
    platformPool
  );
  res.json(rows);
}));

adminWorkflowsRouter.post("/:tenantId/workflows", asyncHandler(async (req, res) => {
  const { name, description, fields, requiredDocuments } = req.body ?? {};
  if (!name || !Array.isArray(fields)) {
    return res.status(400).json({ error: "name and fields (array) are required" });
  }
  const id = await withTenantContext(
    req.params.tenantId,
    async (client) => {
      // pg auto-serializes plain objects to JSON for jsonb parameters,
      // but NOT arrays — a JS array gets converted to Postgres array
      // literal syntax instead, which is invalid JSON for a jsonb
      // column. fields and required_documents are both arrays, so they
      // need an explicit JSON.stringify(); field_values elsewhere in the
      // codebase is a plain object, not an array, which is why that one
      // works without this. Found by actually running this against
      // Postgres, not by inspection — it failed with a JSON syntax error
      // the first time.
      const result = await client.query(
        `INSERT INTO workflows (tenant_id, name, description, fields, required_documents, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          req.params.tenantId,
          name,
          description ?? "",
          JSON.stringify(fields),
          JSON.stringify(requiredDocuments ?? []),
          req.platformAdmin!.platformAdminId,
        ]
      );
      return result.rows[0].id;
    },
    platformPool
  );
  res.status(201).json({ id });
}));

// ---------- approval chain (per workflow) ----------

adminWorkflowsRouter.get("/:tenantId/workflows/:workflowId/approval-steps", asyncHandler(async (req, res) => {
  const rows = await withTenantContext(
    req.params.tenantId,
    async (client) => {
      const result = await client.query(
        `SELECT was.id, was.stage_order, was.role_id, was.assignment_mode, was.condition, r.name AS role_name,
                COALESCE(
                  json_agg(json_build_object('userId', wasa.user_id, 'email', u.email))
                  FILTER (WHERE wasa.user_id IS NOT NULL),
                  '[]'
                ) AS assignees
         FROM workflow_approval_steps was
         JOIN roles r ON r.id = was.role_id
         LEFT JOIN workflow_approval_step_assignees wasa ON wasa.workflow_approval_step_id = was.id
         LEFT JOIN users u ON u.id = wasa.user_id
         WHERE was.workflow_id = $1
         GROUP BY was.id, r.name
         ORDER BY was.stage_order`,
        [req.params.workflowId]
      );
      return result.rows;
    },
    platformPool
  );
  res.json(rows);
}));

adminWorkflowsRouter.post("/:tenantId/workflows/:workflowId/approval-steps", asyncHandler(async (req, res) => {
  const { stageOrder, roleId, assignmentMode, condition, assigneeUserIds } = req.body ?? {};
  if (stageOrder === undefined || !roleId || !assignmentMode) {
    return res.status(400).json({ error: "stageOrder, roleId, and assignmentMode are required" });
  }

  const id = await withTenantContext(
    req.params.tenantId,
    async (client) => {
      // condition is a plain object (or null), not an array, so pg's
      // automatic JSON serialization for jsonb parameters applies
      // correctly here without needing an explicit stringify.
      const stepResult = await client.query(
        `INSERT INTO workflow_approval_steps (workflow_id, stage_order, role_id, assignment_mode, condition)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [req.params.workflowId, stageOrder, roleId, assignmentMode, condition ?? null]
      );
      const stepId = stepResult.rows[0].id;

      for (const userId of (assigneeUserIds ?? []) as string[]) {
        await client.query(
          "INSERT INTO workflow_approval_step_assignees (workflow_approval_step_id, user_id) VALUES ($1, $2)",
          [stepId, userId]
        );
      }

      return stepId;
    },
    platformPool
  );
  res.status(201).json({ id });
}));
