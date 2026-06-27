import { Router } from "express";
import { PoolClient } from "pg";
import { withTenantContext } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { HttpError, asyncHandler } from "../httpError.js";

export const usersRouter = Router();

function requireTenantAdmin(req: Express.Request) {
  if (!req.user?.isTenantAdmin) {
    throw new HttpError(403, "Only a tenant admin can perform this action");
  }
}

/** Pending, currently-in-flight steps assigned to this user. */
async function findAffectedSteps(client: PoolClient, userId: string) {
  const result = await client.query(
    `SELECT ras.id, ras.stage_order, ras.role_id, ras.assignment_mode,
            r.id AS request_id, r.workflow_id, w.name AS workflow_name
     FROM request_approval_steps ras
     JOIN requests r ON r.id = ras.request_id
     JOIN workflows w ON w.id = r.workflow_id
     WHERE ras.assigned_to = $1 AND ras.status = 'pending' AND r.status = 'in_review'`,
    [userId]
  );
  return result.rows;
}

// ---------- GET /:userId/departure-preview ----------
// Read-only — shows what *would* be reassigned, before anything commits.
usersRouter.get("/:userId/departure-preview", requireAuth, asyncHandler(async (req, res) => {
  requireTenantAdmin(req);
  const { tenantId } = req.user!;
  const affected = await withTenantContext(tenantId, (client) =>
    findAffectedSteps(client, req.params.userId)
  );
  res.json({ affectedSteps: affected });
}));

// ---------- POST /:userId/depart ----------
// Immediate — not routed through the team-lead/manager approval flow.
// Gating an urgent departure behind another approval would recreate the
// bottleneck the platform exists to remove (spec Section 10).
usersRouter.post("/:userId/depart", requireAuth, asyncHandler(async (req, res) => {
  requireTenantAdmin(req);
  const { tenantId, userId: actorId } = req.user!;
  const departedUserId = req.params.userId;

  const reassignments = await withTenantContext(tenantId, async (client) => {
    const userResult = await client.query(
      "SELECT id, is_active FROM users WHERE id = $1",
      [departedUserId]
    );
    const user = userResult.rows[0];
    if (!user) throw new HttpError(404, "User not found");
    if (!user.is_active) throw new HttpError(409, "User is already marked departed");

    await client.query("UPDATE users SET is_active = false WHERE id = $1", [departedUserId]);

    // Remove them as a future-eligible assignee everywhere in this
    // tenant — named or pooled, any workflow — before computing
    // replacements below, so a departed person can never be "found" as
    // their own replacement.
    await client.query(
      `DELETE FROM workflow_approval_step_assignees
       WHERE user_id = $1
         AND workflow_approval_step_id IN (
           SELECT was.id FROM workflow_approval_steps was
           JOIN workflows w ON w.id = was.workflow_id
           WHERE w.tenant_id = $2
         )`,
      [departedUserId, tenantId]
    );

    const affected = await findAffectedSteps(client, departedUserId);
    const results = [];

    for (const step of affected) {
      let newAssignedTo: string | null = null;

      if (step.assignment_mode === "named") {
        const replacementResult = await client.query(
          `SELECT wasa.user_id FROM workflow_approval_step_assignees wasa
           JOIN workflow_approval_steps was ON was.id = wasa.workflow_approval_step_id
           WHERE was.workflow_id = $1 AND was.stage_order = $2 AND was.role_id = $3
           LIMIT 1`,
          [step.workflow_id, step.stage_order, step.role_id]
        );
        newAssignedTo = replacementResult.rows[0]?.user_id ?? null;
        // null here means "named, but no replacement designated yet" —
        // distinct from a pooled-unclaimed null, because assignment_mode
        // still reads 'named' on this row. The claim endpoint already
        // refuses to let anyone claim a non-pooled step, so this can't
        // be silently picked up by the wrong person; it just sits until
        // a tenant admin assigns a replacement via the roster.
      }
      // pooled: newAssignedTo stays null — reverts to the remaining pool

      await client.query(
        "UPDATE request_approval_steps SET assigned_to = $1 WHERE id = $2",
        [newAssignedTo, step.id]
      );

      await client.query(
        `INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
         VALUES ($1, $2, 'approval_step.reassigned', 'request_approval_step', $3, $4)`,
        [tenantId, actorId, step.id, { reason: "departure", fromUserId: departedUserId, toUserId: newAssignedTo }]
      );

      results.push({
        stepId: step.id,
        requestId: step.request_id,
        workflowName: step.workflow_name,
        mode: step.assignment_mode,
        reassignedTo: newAssignedTo,
      });
    }

    await client.query(
      `INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, 'user.departed', 'user', $3, $4)`,
      [tenantId, actorId, departedUserId, { reassignedStepCount: results.length }]
    );

    return results;
  });

  res.json({ departedUserId, reassignedSteps: reassignments });
}));
