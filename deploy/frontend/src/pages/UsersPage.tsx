import { useEffect, useState, useCallback } from "react";
import { api, TeamUser } from "../api/client";
import { Header } from "../components/Header";
import { useAuth } from "../auth/AuthContext";

export function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [confirmDepartId, setConfirmDepartId] = useState<string | null>(null);
  const [departing, setDeparting] = useState(false);
  const [preview, setPreview] = useState<{ affectedSteps: any[] } | null>(null);

  const load = useCallback(() => {
    api.listTeamUsers().then(setUsers);
  }, []);

  useEffect(load, [load]);

  async function loadPreview(userId: string) {
    setConfirmDepartId(userId);
    // Reuse the existing departure-preview endpoint
    const res = await fetch(
      `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/users/${userId}/departure-preview`,
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
    const data = await res.json();
    setPreview(data);
  }

  async function confirmDepart(userId: string) {
    setDeparting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000"}/users/${userId}/depart`,
        { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (res.ok) {
        setConfirmDepartId(null);
        setPreview(null);
        load();
      }
    } finally {
      setDeparting(false);
    }
  }

  const active = users.filter((u) => u.is_active);
  const departed = users.filter((u) => !u.is_active);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Header />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Users</h2>
        <a href="/team" className="text-xs text-muted hover:text-ink">← Roster</a>
      </div>

      <div className="rounded-lg border border-line bg-white divide-y divide-line mb-6">
        {active.length === 0 && (
          <p className="text-sm text-muted px-4 py-3">No active users.</p>
        )}
        {active.map((u) => (
          <div key={u.id} className="px-4 py-3">
            {confirmDepartId === u.id ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{u.email}</p>
                    <p className="text-xs text-muted">{u.role_name ?? "No role"}</p>
                  </div>
                  <span className="text-xs font-medium text-reject">Confirm departure</span>
                </div>
                {preview && preview.affectedSteps.length > 0 && (
                  <div className="rounded-md bg-gray-50 border border-line px-3 py-2 mb-2">
                    <p className="text-xs text-muted mb-1">Will be reassigned immediately:</p>
                    {preview.affectedSteps.map((s: any) => (
                      <p key={s.id} className="text-xs">
                        · {s.workflow_name} — {s.assignment_mode === "pooled"
                          ? "returns to pool"
                          : "reassigned to next named approver"}
                      </p>
                    ))}
                  </div>
                )}
                {preview && preview.affectedSteps.length === 0 && (
                  <p className="text-xs text-muted mb-2">No pending approvals will be affected.</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmDepartId(null); setPreview(null); }}
                    className="flex-1 text-xs py-1.5 rounded-md border border-line hover:border-accent transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => confirmDepart(u.id)}
                    disabled={departing || preview === null}
                    className="flex-1 text-xs font-medium py-1.5 rounded-md bg-reject-soft text-reject border border-reject/30 hover:bg-reject hover:text-white transition-colors disabled:opacity-50"
                  >
                    {departing ? "Processing…" : "Confirm departure"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {u.email}
                    {u.is_tenant_admin && (
                      <span className="ml-2 text-xs font-medium text-accent">admin</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">{u.role_name ?? "No role"}</p>
                </div>
                {user?.isTenantAdmin && (
                  <button
                    onClick={() => loadPreview(u.id)}
                    className="text-xs text-muted hover:text-reject transition-colors"
                  >
                    Mark departed
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {departed.length > 0 && (
        <>
          <p className="text-xs text-muted font-medium mb-2">Departed</p>
          <div className="rounded-lg border border-line bg-white divide-y divide-line opacity-55">
            {departed.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm">{u.email}</p>
                  <p className="text-xs text-muted">{u.role_name ?? "No role"}</p>
                </div>
                <span className="text-xs text-muted">Departed</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
