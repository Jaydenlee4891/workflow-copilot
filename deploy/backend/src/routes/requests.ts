import { Router } from "express";
import { PoolClient } from "pg";
import { withTenantContext } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { HttpError, asyncHandler } from "../httpError.js";
import { evaluateCondition } from "../conditions.js";

export const requestsRouter = Router();

interface WorkflowField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

// ---------- POST / : create a draft request ----------
// Creates the request in 'draft' status so documents can be attached to a
// real request id while the user fills out the form. Approval steps are
// NOT cloned here — that happens at submit. Required-field validation also
// happens at submit, since a draft is allowed to be incomplete.
requestsRouter.post("/", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.user!;
  const { workflowId, fieldValues } = req.body ?? {};
  if (!workflowId) {
    return res.status(400).json({ error: "workflowId is required" });
  }

  const requestId = await withTenantContext(tenantId, async (client) => {
    const workflowResult = await client.query(
      "SELECT id FROM workflows WHERE id = $1 AND is_active = true",
      [workflowId]
    );
    if (!workflowResult.rows[0]) throw new HttpError(404, "Workflow not found");

    const insertResult = await client.query(
      `INSERT INTO requests (tenant_id, workflow_id, requester_id, field_values, status, current_stage_order)
       VALUES ($1, $2, $3, $4, 'draft', 1) RETURNING id`,
      [tenantId, workflowId, userId, fieldValues ?? {}]
    );
    return insertResult.rows[0].id;
  });

  res.status(201).json({ id: requestId });
}));

// ---------- POST /:id/submit : promote a draft to in_review ----------
// Validates required fields, clones the workflow's approval steps onto the
// request (evaluating conditions), and flips status draft -> in_review.
requestsRouter.post("/:id/submit", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.user!;
  const { fieldValues } = req.body ?? {};

  await withTenantContext(tenantId, async (client) => {
    const requestResult = await client.query(
      "SELECT id, workflow_id, status, requester_id FROM requests WHERE id = $1",
      [req.params.id]
    );
    const request = requestResult.rows[0];
    if (!request) throw new HttpError(404, "Request not found");
    if (request.requester_id !== userId) throw new HttpError(403, "Not your request");
    if (request.status !== "draft") throw new HttpError(409, `Request is already ${request.status}`);

    // Allow the final field values to be sent with submit, falling back to
    // whatever was saved on the draft.
    const finalValues = fieldValues ?? {};
    const workflowResult = await client.query(
      "SELECT fields FROM workflows WHERE id = $1",
      [request.workflow_id]
    );
    const fields = workflowResult.rows[0].fields as WorkflowField[];
    for (const field of fields) {
      if (field.required && (finalValues[field.id] === undefined || finalValues[field.id] === "")) {
        throw new HttpError(400, `Missing required field: ${field.label}`);
      }
    }

    await client.query(
      "UPDATE requests SET field_values = $1, status = 'in_review', current_stage_order = 1, updated_at = now() WHERE id = $2",
      [finalValues, request.id]
    );

    const stepsResult = await client.query(
      `SELECT id, stage_order, role_id, assignment_mode, condition
       FROM workflow_approval_steps WHERE workflow_id = $1 ORDER BY stage_order`,
      [request.workflow_id]
    );

    for (const step of stepsResult.rows) {
      if (!evaluateCondition(step.condition, finalValues)) continue;

      let assignedTo: string | null = null;
      if (step.assignment_mode === "named") {
        const assigneeResult = await client.query(
          "SELECT user_id FROM workflow_approval_step_assignees WHERE workflow_approval_step_id = $1 LIMIT 1",
          [step.id]
        );
        assignedTo = assigneeResult.rows[0]?.user_id ?? null;
      }
      // pooled steps stay unassigned (assignedTo null) until claimed

      await client.query(
        `INSERT INTO request_approval_steps (request_id, stage_order, role_id, assignment_mode, assigned_to, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')`,
        [request.id, step.stage_order, step.role_id, step.assignment_mode, assignedTo]
      );
    }

    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'request.submitted', 'request', $3, $4)`,
      [tenantId, userId, request.id, { workflowId: request.workflow_id }]
    );
  });

  res.json({ status: "in_review" });
}));

// ---------- GET /:id : full detail for the timeline ----------
requestsRouter.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId } = req.user!;

  const data = await withTenantContext(tenantId, async (client) => {
    const requestResult = await client.query(
      `SELECT r.id, r.status, r.current_stage_order, r.field_values, r.created_at,
              w.name AS workflow_name
       FROM requests r JOIN workflows w ON w.id = r.workflow_id
       WHERE r.id = $1`,
      [req.params.id]
    );
    const request = requestResult.rows[0];
    if (!request) return null;

    const stepsResult = await client.query(
      `SELECT ras.id, ras.stage_order, ras.assignment_mode, ras.assigned_to, ras.status,
              ras.comments, ras.decided_at, ro.name AS role_name
       FROM request_approval_steps ras
       JOIN roles ro ON ro.id = ras.role_id
       WHERE ras.request_id = $1
       ORDER BY ras.stage_order`,
      [req.params.id]
    );

    return { ...request, steps: stepsResult.rows };
  });

  if (!data) return res.status(404).json({ error: "Request not found" });
  res.json(data);
}));

/**
 * Shared validation for approve/reject: loads the request and step, and
 * confirms the step is pending, at the request's current active stage,
 * and assigned to the caller. Throws HttpError otherwise.
 */
async function loadActionableStep(
  client: PoolClient,
  requestId: string,
  stepId: string,
  userId: string
) {
  const requestResult = await client.query(
    "SELECT id, current_stage_order, status FROM requests WHERE id = $1",
    [requestId]
  );
  const request = requestResult.rows[0];
  if (!request) throw new HttpError(404, "Request not found");
  if (request.status !== "in_review") {
    throw new HttpError(409, `Request is already ${request.status}`);
  }

  const stepResult = await client.query(
    "SELECT * FROM request_approval_steps WHERE id = $1 AND request_id = $2",
    [stepId, requestId]
  );
  const step = stepResult.rows[0];
  if (!step) throw new HttpError(404, "Approval step not found");
  if (step.status !== "pending") throw new HttpError(409, `Step is already ${step.status}`);
  if (step.stage_order !== request.current_stage_order) {
    throw new HttpError(409, "This step is not at the active stage yet");
  }
  if (step.assigned_to !== userId) {
    throw new HttpError(403, "You are not the assigned approver for this step");
  }

  return { request, step };
}

// ---------- POST /:requestId/steps/:stepId/approve ----------
requestsRouter.post("/:requestId/steps/:stepId/approve", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.user!;
  const { requestId, stepId } = req.params;
  const { comments } = req.body ?? {};

  const result = await withTenantContext(tenantId, async (client) => {
    const { request } = await loadActionableStep(client, requestId, stepId, userId);

    await client.query(
      "UPDATE request_approval_steps SET status = 'approved', comments = $1, decided_at = now() WHERE id = $2",
      [comments ?? null, stepId]
    );

    // Parallel-stage completion check: every step sharing this
    // stage_order must be approved before the request can advance.
    const stageResult = await client.query(
      `SELECT bool_and(status = 'approved') AS complete
       FROM request_approval_steps WHERE request_id = $1 AND stage_order = $2`,
      [requestId, request.current_stage_order]
    );

    let newStageOrder = request.current_stage_order;
    let newStatus = "in_review";

    if (stageResult.rows[0].complete) {
      const nextStageResult = await client.query(
        `SELECT MIN(stage_order) AS next FROM request_approval_steps
         WHERE request_id = $1 AND stage_order > $2`,
        [requestId, request.current_stage_order]
      );
      const next = nextStageResult.rows[0].next;
      if (next === null) {
        newStatus = "approved";
      } else {
        newStageOrder = next;
      }
      await client.query(
        "UPDATE requests SET status = $1, current_stage_order = $2, updated_at = now() WHERE id = $3",
        [newStatus, newStageOrder, requestId]
      );
    }

    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'approval.approved', 'request_approval_step', $3, $4)`,
      [tenantId, userId, stepId, { comments: comments ?? null }]
    );

    return { requestStatus: newStatus, currentStageOrder: newStageOrder };
  });

  res.json(result);
}));

// ---------- POST /:requestId/steps/:stepId/reject ----------
requestsRouter.post("/:requestId/steps/:stepId/reject", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.user!;
  const { requestId, stepId } = req.params;
  const { comments } = req.body ?? {};

  await withTenantContext(tenantId, async (client) => {
    await loadActionableStep(client, requestId, stepId, userId);

    await client.query(
      "UPDATE request_approval_steps SET status = 'rejected', comments = $1, decided_at = now() WHERE id = $2",
      [comments ?? null, stepId]
    );
    // One rejection anywhere in a stage rejects the whole request
    // immediately — no partial-approval state (schema.sql comment).
    await client.query(
      "UPDATE requests SET status = 'rejected', updated_at = now() WHERE id = $1",
      [requestId]
    );
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'approval.rejected', 'request_approval_step', $3, $4)`,
      [tenantId, userId, stepId, { comments: comments ?? null }]
    );
  });

  res.json({ requestStatus: "rejected" });
}));

// ---------- POST /:requestId/steps/:stepId/claim ----------
requestsRouter.post("/:requestId/steps/:stepId/claim", requireAuth, asyncHandler(async (req, res) => {
  const { tenantId, userId } = req.user!;
  const { requestId, stepId } = req.params;

  await withTenantContext(tenantId, async (client) => {
    const requestResult = await client.query(
      "SELECT workflow_id FROM requests WHERE id = $1",
      [requestId]
    );
    const request = requestResult.rows[0];
    if (!request) throw new HttpError(404, "Request not found");

    const stepResult = await client.query(
      "SELECT * FROM request_approval_steps WHERE id = $1 AND request_id = $2",
      [stepId, requestId]
    );
    const step = stepResult.rows[0];
    if (!step) throw new HttpError(404, "Approval step not found");
    if (step.assignment_mode !== "pooled") throw new HttpError(409, "This step is not pooled");
    if (step.assigned_to !== null) throw new HttpError(409, "This step has already been claimed");

    // request_approval_steps deliberately has no FK back to its
    // originating workflow_approval_steps row (it's a frozen snapshot —
    // see schema.sql), so eligibility is derived via the natural key
    // (workflow_id, stage_order, role_id) instead.
    const eligibleResult = await client.query(
      `SELECT 1 FROM workflow_approval_step_assignees wasa
       JOIN workflow_approval_steps was ON was.id = wasa.workflow_approval_step_id
       WHERE was.workflow_id = $1 AND was.stage_order = $2 AND was.role_id = $3
         AND wasa.user_id = $4`,
      [request.workflow_id, step.stage_order, step.role_id, userId]
    );
    if (eligibleResult.rows.length === 0) {
      throw new HttpError(403, "You are not eligible to claim this step");
    }

    await client.query(
      "UPDATE request_approval_steps SET assigned_to = $1 WHERE id = $2",
      [userId, stepId]
    );
    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'approval_step.claimed', 'request_approval_step', $3, '{}')`,
      [tenantId, userId, stepId]
    );
  });

  res.json({ status: "claimed" });
}));
