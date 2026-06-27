import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi, Role, PlatformApiError } from "../../api/client";

export function StepRoles({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function reload() {
    platformApi.listRoles(tenantId).then(setRoles);
  }

  useEffect(reload, [tenantId]);

  async function addRole() {
    if (!name.trim() || !level) return;
    setSaving(true);
    setError(null);
    try {
      await platformApi.createRole(tenantId, { name: name.trim(), hierarchyLevel: parseInt(level) });
      setName("");
      setLevel("");
      reload();
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="font-display font-semibold text-sm mb-1">Role hierarchy</h2>
      <p className="text-xs text-muted mb-4">
        Define the positions that exist in this organisation. Lower hierarchy level = more senior (1 = top).
      </p>

      <div className="rounded-lg border border-line bg-white mb-4">
        {roles.length === 0 && (
          <p className="text-sm text-muted px-4 py-3">No roles yet.</p>
        )}
        {[...roles].sort((a, b) => a.hierarchy_level - b.hierarchy_level).map((r, i) => (
          <div key={r.id}
            className={`flex items-center justify-between px-4 py-2.5 ${
              i < roles.length - 1 ? "border-b border-line" : ""
            }`}>
            <span className="text-sm">{r.name}</span>
            <span className="text-xs text-muted">level {r.hierarchy_level}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-white p-4 mb-6">
        <p className="text-xs text-muted mb-2">Add a role</p>
        <div className="flex gap-2">
          <input placeholder="Role name (e.g. Supervisor)"
            value={name} onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          <input placeholder="Level" type="number" min={1}
            value={level} onChange={(e) => setLevel(e.target.value)}
            className="w-20 rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          <button onClick={addRole} disabled={saving || !name.trim() || !level}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-line hover:border-accent transition-colors disabled:opacity-50">
            Add
          </button>
        </div>
        {error && <p className="text-xs text-reject mt-2">{error}</p>}
      </div>

      <button onClick={() => navigate(`/admin/tenants/${tenantId}/onboarding/3`)}
        disabled={roles.length === 0}
        className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
        Continue →
      </button>
      {roles.length === 0 && (
        <p className="text-xs text-muted mt-2 text-center">Add at least one role to continue.</p>
      )}
    </div>
  );
}
