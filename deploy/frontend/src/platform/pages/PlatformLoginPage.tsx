import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { usePlatformAuth } from "../auth/PlatformAuthContext";
import { PlatformApiError } from "../api/client";

export function PlatformLoginPage() {
  const { login } = usePlatformAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof PlatformApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="font-display font-semibold text-xl mb-1">Workflow Copilot</h1>
        <p className="text-sm text-muted mb-6">Platform staff sign-in</p>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="email">Email</label>
            <input id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1" htmlFor="password">Password</label>
            <input id="password" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent" />
          </div>
        </div>
        {error && <p className="text-xs text-reject mb-3">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full rounded-md bg-ink text-white text-sm font-medium py-2 hover:bg-ink/90 transition-colors disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
