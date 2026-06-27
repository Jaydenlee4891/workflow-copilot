import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { PlatformAuthProvider, usePlatformAuth } from "./platform/auth/PlatformAuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NewRequestPage } from "./pages/NewRequestPage";
import { RequestDetailPage } from "./pages/RequestDetailPage";
import { RosterPage } from "./pages/RosterPage";
import { UsersPage } from "./pages/UsersPage";
import { PlatformLoginPage } from "./platform/pages/PlatformLoginPage";
import { TenantListPage } from "./platform/pages/TenantListPage";
import { OnboardingWizardPage } from "./platform/pages/OnboardingWizardPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PlatformRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = usePlatformAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Tenant-user routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/requests/new/:workflowId" element={<ProtectedRoute><NewRequestPage /></ProtectedRoute>} />
      <Route path="/requests/:id" element={<ProtectedRoute><RequestDetailPage /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><RosterPage /></ProtectedRoute>} />
      <Route path="/team/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />

      {/* Platform-admin routes */}
      <Route path="/admin/login" element={<PlatformLoginPage />} />
      <Route path="/admin" element={<PlatformRoute><TenantListPage /></PlatformRoute>} />
      <Route path="/admin/tenants/new/onboarding/:step" element={<PlatformRoute><OnboardingWizardPage /></PlatformRoute>} />
      <Route path="/admin/tenants/:tenantId/onboarding/:step" element={<PlatformRoute><OnboardingWizardPage /></PlatformRoute>} />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <PlatformAuthProvider>
        <AppRoutes />
      </PlatformAuthProvider>
    </AuthProvider>
  );
}
