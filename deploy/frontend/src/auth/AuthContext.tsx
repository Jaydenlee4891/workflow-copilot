import { createContext, useContext, useState, ReactNode } from "react";
import { api } from "../api/client";

interface AuthUser {
  userId: string;
  tenantId: string;
  isTenantAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (tenantId: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Decodes the JWT payload without verifying its signature — that's fine
 * here, since this is only used for convenience (e.g. showing tenant-admin
 * UI). It is never treated as an authorization decision: every endpoint
 * re-verifies the signature and re-checks permissions server-side
 * regardless of what the client believes about itself.
 */
function decodeToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { userId: payload.userId, tenantId: payload.tenantId, isTenantAdmin: payload.isTenantAdmin };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = localStorage.getItem("token");
    return token ? decodeToken(token) : null;
  });

  async function login(tenantId: string, email: string, password: string) {
    const { token } = await api.login(tenantId, email, password);
    localStorage.setItem("token", token);
    setUser(decodeToken(token));
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
