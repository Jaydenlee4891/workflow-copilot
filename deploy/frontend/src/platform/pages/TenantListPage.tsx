import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platformApi, TenantSummary } from "../api/client";
import { usePlatformAuth } from "../auth/PlatformAuthContext";

export function TenantListPage() {
  const { logout } = usePlatformAuth();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformApi.listTenants().then(setTenants).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-semibold text-base">Tenants</h1>
        <div className="flex items-center gap-3">
          <Link to="/admin/tenants/new/onboarding/1"
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-ink text-white hover:bg-ink/90 transition-colors">
            + Onboard new tenant
          </Link>
          <button onClick={logout} className="text-xs text-muted hover:text-ink">Log out</button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="rounded-lg border border-line bg-white">
          {tenants.length === 0 && (
            <p className="text-sm text-muted p-4">No tenants yet. Onboard your first one.</p>
          )}
          {tenants.map((t, i) => (
            <Link key={t.id}
              to={t.status === "onboarding"
                ? `/admin/tenants/${t.id}/onboarding/1`
                : `/admin/tenants/${t.id}`}
              className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                i < tenants.length - 1 ? "border-b border-line" : ""
              }`}>
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {t.auth_method === "cac" ? "CAC" : "Password"} auth ·{" "}
                  {t.workflow_count} workflow{t.workflow_count !== "1" ? "s" : ""} ·{" "}
                  {t.user_count} user{t.user_count !== "1" ? "s" : ""}
                </p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                t.status === "live"
                  ? "bg-approve-soft text-approve"
                  : "bg-amber-50 text-amber-700"
              }`}>
                {t.status === "live" ? "Live" : "Onboarding"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
