import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  platformApi, Role, TenantUser, WorkflowSummary,
  WorkflowField, ApprovalStepTemplate, PlatformApiError,
} from "../../api/client";

interface DraftStep {
  stageOrder: number;
  roleId: string;
  assignmentMode: "named" | "pooled";
  condition: { field: string; operator: string; value: string } | null;
  assigneeUserIds: string[];
}

const OPERATORS = [">", ">=", "<", "<=", "==", "!="];

export function StepChains({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("");
  const [workflowFields, setWorkflowFields] = useState<WorkflowField[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [existingSteps, setExistingSteps] = useState<ApprovalStepTemplate[]>([]);
  const [draft, setDraft] = useState<DraftStep>({
    stageOrder: 1, roleId: "", assignmentMode: "named", condition: null, assigneeUserIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      platformApi.listWorkflows(tenantId),
      platformApi.listRoles(tenantId),
      platformApi.listUsers(tenantId),
    ]).then(([w, r, u]) => {
      setWorkflows(w);
      setRoles(r);
      setUsers(u);
      if (w.length > 0) setSelectedWorkflow(w[0].id);
    });
  }, [tenantId]);

  useEffect(() => {
    if (!selectedWorkflow) return;
    const wf = workflows.find((w) => w.id === selectedWorkflow) as any;
    setWorkflowFields(wf?.fields ?? []);
    platformApi.listApprovalSteps(tenantId, selectedWorkflow).then((steps) => {
      setExistingSteps(steps);
      const maxStage = steps.reduce((m, s) => Math.max(m, s.stage_order), 0);
      setDraft((d) => ({ ...d, stageOrder: maxStage + 1 }));
    });
  }, [selectedWorkflow, tenantId]);

  // Group existing steps by stage for display
  const byStage = existingSteps.reduce<Record<number, ApprovalStepTemplate[]>>((acc, s) => {
    (acc[s.stage_order] ??= []).push(s);
    return acc;
  }, {});

  async function addStep() {
    if (!draft.roleId) return;
    setSaving(true);
    setError(null);
    try {
      await platformApi.createApprovalStep(tenantId, selectedWorkflow, {
        stageOrder: draft.stageOrder,
        roleId: draft.roleId,
        assignmentMode: draft.assignmentMode,
        condition: draft.condition,
        assigneeUserIds: draft.assignmentMode === "named" ? draft.assigneeUserIds : [],
      });
      const steps = await platformApi.listApprovalSteps(tenantId, selectedWorkflow);
      setExistingSteps(steps);
      const maxStage = steps.reduce((m, s) => Math.max(m, s.stage_order), 0);
      setDraft((d) => ({ ...d, roleId: "", assignmentMode: "named", condition: null, assigneeUserIds: [], stageOrder: maxStage + 1 }));
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  return (
    <div>
      <h2 className="font-display font-semibold text-sm mb-1">Approval chains</h2>
      <p className="text-xs text-muted mb-4">
        Build the approval chain for each workflow. Steps at the same stage run in parallel — all must approve before advancing.
      </p>

      {workflows.length > 1 && (
        <div className="mb-4">
          <label className="text-xs text-muted block mb-1">Workflow</label>
          <select value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent">
            {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      )}

      {/* Existing chain display */}
      {Object.keys(byStage).length > 0 && (
        <div className="mb-4 space-y-2">
          {Object.entries(byStage).sort(([a], [b]) => Number(a) - Number(b)).map(([stage, steps]) => (
            <div key={stage} className="flex gap-2">
              <div className="flex-shrink-0 w-14 pt-2.5">
                <span className="text-xs text-muted font-medium">Stage {stage}</span>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                {steps.map((s) => (
                  <div key={s.id} className="rounded-md border border-line bg-white px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{s.role_name}</span>
                      <span className="text-xs text-muted">{s.assignment_mode}</span>
                    </div>
                    {s.assignees.length > 0 && (
                      <p className="text-xs text-muted mt-0.5">
                        {s.assignees.map((a) => a.email).join(", ")}
                      </p>
                    )}
                    {s.condition && (
                      <p className="text-xs text-accent mt-0.5">
                        Only when {s.condition.field} {s.condition.operator} {String(s.condition.value)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add step form */}
      <div className="rounded-lg border border-line bg-white p-4 mb-6 space-y-3">
        <p className="text-xs text-muted font-medium">Add a step</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted block mb-1">Stage</label>
            <input type="number" min={1} value={draft.stageOrder}
              onChange={(e) => setDraft((d) => ({ ...d, stageOrder: parseInt(e.target.value) || 1 }))}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Role</label>
            <select value={draft.roleId}
              onChange={(e) => setDraft((d) => ({ ...d, roleId: e.target.value }))}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent">
              <option value="">Select role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Assignment</label>
            <div className="flex rounded-md border border-line overflow-hidden">
              {(["named", "pooled"] as const).map((m) => (
                <button key={m} onClick={() => setDraft((d) => ({ ...d, assignmentMode: m, assigneeUserIds: [] }))}
                  className={`flex-1 text-xs py-1.5 transition-colors ${
                    draft.assignmentMode === m ? "bg-ink text-white" : "text-muted hover:text-ink"
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Assignee picker */}
        {draft.roleId && (
          <div>
            <label className="text-xs text-muted block mb-1">
              {draft.assignmentMode === "named" ? "Named approver(s)" : "Eligible pool"}
            </label>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox"
                    checked={draft.assigneeUserIds.includes(u.id)}
                    onChange={(e) => setDraft((d) => ({
                      ...d,
                      assigneeUserIds: e.target.checked
                        ? [...d.assigneeUserIds, u.id]
                        : d.assigneeUserIds.filter((id) => id !== u.id),
                    }))} />
                  {u.email}
                  {u.role_id && <span className="text-muted">({roleMap[u.role_id]})</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Condition */}
        <div>
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer mb-1">
            <input type="checkbox" checked={draft.condition !== null}
              onChange={(e) => setDraft((d) => ({
                ...d,
                condition: e.target.checked ? { field: "", operator: ">", value: "" } : null,
              }))} />
            Only include this step when a condition is met
          </label>
          {draft.condition && (
            <div className="flex gap-2 mt-1">
              <select value={draft.condition.field}
                onChange={(e) => setDraft((d) => ({ ...d, condition: { ...d.condition!, field: e.target.value } }))}
                className="flex-1 rounded-md border border-line px-2 py-1.5 text-xs bg-white">
                <option value="">Field…</option>
                {workflowFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <select value={draft.condition.operator}
                onChange={(e) => setDraft((d) => ({ ...d, condition: { ...d.condition!, operator: e.target.value } }))}
                className="w-16 rounded-md border border-line px-2 py-1.5 text-xs bg-white">
                {OPERATORS.map((op) => <option key={op}>{op}</option>)}
              </select>
              <input placeholder="Value" value={draft.condition.value}
                onChange={(e) => setDraft((d) => ({ ...d, condition: { ...d.condition!, value: e.target.value } }))}
                className="w-24 rounded-md border border-line px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
            </div>
          )}
        </div>

        {error && <p className="text-xs text-reject">{error}</p>}

        <button onClick={addStep} disabled={saving || !draft.roleId}
          className="w-full rounded-md border border-line text-sm font-medium py-1.5 hover:border-accent transition-colors disabled:opacity-50">
          {saving ? "Adding…" : "Add step"}
        </button>
      </div>

      <button onClick={() => navigate(`/admin/tenants/${tenantId}/onboarding/6`)}
        disabled={existingSteps.length === 0}
        className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
        Continue →
      </button>
    </div>
  );
}
