import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(tenantId, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="font-display font-semibold text-xl mb-1">Workflow Copilot</h1>
        <p className="text-sm text-muted mb-6">Sign in to your workspace</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="tenantId">
              Tenant ID
            </label>
            <input
              id="tenantId"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="UUID — see note below"
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
            />
          </div>
        </div>

        {error && <p className="text-xs text-reject mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-xs text-muted mt-4 leading-relaxed">
          A login screen shouldn't really ask for a raw tenant ID — there's no resolved way yet for
          this screen to know which tenant it belongs to (subdomain, a URL slug, an org picker are
          the real options). This field is an honest placeholder for that open question, not a
          finished design.
        </p>
      </form>
    </div>
  );
}
