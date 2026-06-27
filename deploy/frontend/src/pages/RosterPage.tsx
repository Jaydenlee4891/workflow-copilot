import { useEffect, useState, useCallback } from "react";
import { api, RosterWorkflow, TeamUser } from "../api/client";
import { Header } from "../components/Header";
import { useAuth } from "../auth/AuthContext";

export function RosterPage() {
  const { user } = useAuth();
  const [roster, setRoster] = useState<RosterWorkflow[]>([]);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.getRoster(), api.listTeamUsers()]).then(([r, u]) => {
      setRoster(r);
      setUsers(u.filter((u) => u.is_active));
    });
  }, []);

  useEffect(load, [load]);

  function startEdit(stepId: string, currentAssignees: { userId: string }[]) {
    setEditingStepId(stepId);
    setDraftIds(currentAssignees.map((a) => a.userId));
  }

  async function saveEdit(stepId: string) {
    setSaving(true);
    try {
      await api.updateStepAssignees(stepId, draftIds);
      setEditingStepId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Header />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Team &amp; assignments</h2>
        <a href="/team/users" className="text-xs text-muted hover:text-ink">Manage users →</a>
      </div>

      {roster.length === 0 && (
        <p className="text-sm text-muted">No workflows configured yet.</p>
      )}

      <div className="space-y-6">
        {roster.map((wf) => (
          <div key={wf.workflowId}>
            <p className="text-xs text-muted font-medium mb-2">{wf.workflowName}</p>
            <div className="rounded-lg border border-line bg-white divide-y divide-line">
              {wf.steps.map((step) => {
                const isEditing = editingStepId === step.stepId;
                return (
                  <div key={step.stepId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted">Stage {step.stageOrder}</span>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-sm font-medium">{step.roleName}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                            step.assignmentMode === "pooled"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}>
                            {step.assignmentMode}
                          </span>
                        </div>
                        {!isEditing && (
                          <p className="text-xs text-muted">
                            {step.assignees.length === 0
                              ? "No assignees"
                              : step.assignees.map((a) => a.email).join(", ")}
                          </p>
                        )}
                        {isEditing && (
                          <div className="mt-2 space-y-1.5">
                            {users.map((u) => (
                              <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={draftIds.includes(u.id)}
                                  onChange={(e) =>
                                    setDraftIds((ids) =>
                                      e.target.checked
                                        ? [...ids, u.id]
                                        : ids.filter((id) => id !== u.id)
                                    )
                                  }
                                />
                                <span>{u.email}</span>
                                {u.role_name && (
                                  <span className="text-muted">({u.role_name})</span>
                                )}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {user?.isTenantAdmin && (
                        <div className="flex gap-2 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setEditingStepId(null)}
                                className="text-xs text-muted hover:text-ink"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveEdit(step.stepId)}
                                disabled={saving}
                                className="text-xs font-medium px-2.5 py-1 rounded-md bg-ink text-white hover:bg-ink/90 transition-colors disabled:opacity-50"
                              >
                                {saving ? "Saving…" : "Save"}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(step.stepId, step.assignees)}
                              className="text-xs text-muted hover:text-ink"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
