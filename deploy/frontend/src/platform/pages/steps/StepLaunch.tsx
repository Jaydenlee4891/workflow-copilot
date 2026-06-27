import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi, TenantDetail, Role, TenantUser, WorkflowSummary, PlatformApiError } from "../../api/client";

export function StepLaunch({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      platformApi.getTenant(tenantId),
      platformApi.listRoles(tenantId),
      platformApi.listUsers(tenantId),
      platformApi.listWorkflows(tenantId),
    ]).then(([t, r, u, w]) => {
      setTenant(t); setRoles(r); setUsers(u); setWorkflows(w);
    });
  }, [tenantId]);

  async function launch() {
    setLaunching(true);
    setError(null);
    try {
      await platformApi.launchTenant(tenantId);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
      setLaunching(false);
    }
  }

  if (!tenant) return <p className="text-sm text-muted">Loading…</p>;

  const isAlreadyLive = tenant.status === "live";

  return (
    <div>
      <h2 className="font-display font-semibold text-sm mb-1">Review & launch</h2>
      <p className="text-xs text-muted mb-4">Confirm the configuration before going live.</p>

      <div className="rounded-lg border border-line bg-white divide-y divide-line mb-6">
        <Row label="Organisation" value={tenant.name} />
        <Row label="Auth method" value={tenant.auth_method === "cac" ? "CAC" : "Email / password"} />
        <Row label="Notifications" value={tenant.notification_channel} />
        <Row label="Roles" value={roles.length === 0 ? "None — go back to step 2" : roles.map((r) => r.name).join(", ")} warn={roles.length === 0} />
        <Row label="Users" value={users.length === 0 ? "None — go back to step 3" : `${users.length} user${users.length > 1 ? "s" : ""}`} warn={users.length === 0} />
        <Row label="Workflows" value={workflows.length === 0 ? "None — go back to step 4" : workflows.map((w) => w.name).join(", ")} warn={workflows.length === 0} />
      </div>

      {isAlreadyLive && (
        <p className="text-xs text-approve mb-4">
          This tenant is already live. No action needed.
        </p>
      )}

      {error && <p className="text-xs text-reject mb-3">{error}</p>}

      {!isAlreadyLive && (
        <button onClick={launch} disabled={launching || roles.length === 0 || users.length === 0 || workflows.length === 0}
          className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
          {launching ? "Launching…" : "Launch tenant"}
        </button>
      )}

      {isAlreadyLive && (
        <button onClick={() => navigate("/admin")}
          className="w-full rounded-md border border-line text-sm font-medium py-2 hover:border-accent transition-colors">
          Back to tenant list
        </button>
      )}
    </div>
  );
}

function Row({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-start justify-between px-4 py-2.5">
      <span className="text-xs text-muted flex-shrink-0 w-28">{label}</span>
      <span className={`text-sm text-right ${warn ? "text-reject" : ""}`}>{value}</span>
    </div>
  );
}
