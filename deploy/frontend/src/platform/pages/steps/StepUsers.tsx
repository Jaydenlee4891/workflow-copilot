import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi, Role, TenantUser, PlatformApiError } from "../../api/client";

export function StepUsers({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    Promise.all([platformApi.listUsers(tenantId), platformApi.listRoles(tenantId)]).then(
      ([u, r]) => { setUsers(u); setRoles(r); }
    );
  }

  useEffect(reload, [tenantId]);

  async function addUser() {
    if (!email.trim() || !password) return;
    setSaving(true);
    setError(null);
    try {
      await platformApi.createUser(tenantId, {
        email: email.trim(), password,
        roleId: roleId || undefined,
        isTenantAdmin,
      });
      setEmail(""); setPassword(""); setRoleId(""); setIsTenantAdmin(false);
      reload();
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const roleMap = Object.fromEntries(roles.map((r) => [r.id, r.name]));

  return (
    <div>
      <h2 className="font-display font-semibold text-sm mb-1">Users</h2>
      <p className="text-xs text-muted mb-4">
        Create initial accounts for this organisation. Passwords can be changed later.
      </p>

      <div className="rounded-lg border border-line bg-white mb-4">
        {users.length === 0 && <p className="text-sm text-muted px-4 py-3">No users yet.</p>}
        {users.map((u, i) => (
          <div key={u.id}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < users.length - 1 ? "border-b border-line" : ""
            }`}>
            <div>
              <span className="text-sm">{u.email}</span>
              {u.is_tenant_admin && (
                <span className="ml-2 text-xs font-medium text-accent">admin</span>
              )}
            </div>
            <span className="text-xs text-muted">{u.role_id ? roleMap[u.role_id] : "No role"}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-white p-4 mb-6 space-y-3">
        <p className="text-xs text-muted">Add a user</p>
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          <input placeholder="Temporary password" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
        </div>
        <div className="flex gap-2">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
            className="flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent">
            <option value="">No role</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-muted flex-shrink-0 cursor-pointer">
            <input type="checkbox" checked={isTenantAdmin}
              onChange={(e) => setIsTenantAdmin(e.target.checked)} />
            Tenant admin
          </label>
          <button onClick={addUser} disabled={saving || !email.trim() || !password}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-line hover:border-accent transition-colors disabled:opacity-50">
            Add
          </button>
        </div>
        {error && <p className="text-xs text-reject">{error}</p>}
      </div>

      <button onClick={() => navigate(`/admin/tenants/${tenantId}/onboarding/4`)}
        disabled={users.length === 0}
        className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
        Continue →
      </button>
    </div>
  );
}
