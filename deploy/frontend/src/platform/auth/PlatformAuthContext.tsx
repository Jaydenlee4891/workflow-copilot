import { createContext, useContext, useState, ReactNode } from "react";
import { platformApi } from "../api/client";

interface PlatformAuthContextValue {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const PlatformAuthContext = createContext<PlatformAuthContextValue | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem("platform_token")
  );

  async function login(email: string, password: string) {
    const { token } = await platformApi.login(email, password);
    localStorage.setItem("platform_token", token);
    setIsAuthenticated(true);
  }

  function logout() {
    localStorage.removeItem("platform_token");
    setIsAuthenticated(false);
  }

  return (
    <PlatformAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthContextValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
