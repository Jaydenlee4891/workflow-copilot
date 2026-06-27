import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi, PlatformApiError } from "../../api/client";

export function StepBasics({ tenantId }: { tenantId: string }) {
  const navigate = useNavigate();
  const isNew = tenantId === "new";
  const [name, setName] = useState("");
  const [authMethod, setAuthMethod] = useState("password");
  const [notificationChannel, setNotificationChannel] = useState("email");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { id } = await platformApi.createTenant({ name, authMethod, notificationChannel });
      navigate(`/admin/tenants/${id}/onboarding/2`);
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="font-display font-semibold text-sm mb-4">Organisation details</h2>
      <div className="rounded-lg border border-line bg-white p-4 space-y-4 mb-6">
        <div>
          <label className="block text-xs text-muted mb-1">Organisation name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Authentication method</label>
          <select value={authMethod} onChange={(e) => setAuthMethod(e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent">
            <option value="password">Email / password</option>
            <option value="cac">CAC (military)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Notification channel</label>
          <select value={notificationChannel} onChange={(e) => setNotificationChannel(e.target.value)}
            className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent">
            <option value="email">Email</option>
            <option value="teams">Microsoft Teams</option>
            <option value="slack">Slack</option>
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-reject mb-3">{error}</p>}
      <button type="submit" disabled={saving || !isNew}
        className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
        {saving ? "Creating…" : isNew ? "Create tenant & continue →" : "Continue →"}
      </button>
      {!isNew && (
        <p className="text-xs text-muted mt-2 text-center">Tenant already created — continue to the next step.</p>
      )}
    </form>
  );
}
