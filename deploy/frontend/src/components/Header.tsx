import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function Header() {
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="font-display font-semibold text-base">
          Workflow Copilot
        </Link>
        {user?.isTenantAdmin && (
          <Link to="/team" className="text-xs text-muted hover:text-ink">
            Team
          </Link>
        )}
      </div>
      <button onClick={logout} className="text-xs text-muted hover:text-ink">
        Log out
      </button>
    </div>
  );
}
