const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class PlatformApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getPlatformToken(): string | null {
  return localStorage.getItem("platform_token");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getPlatformToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new PlatformApiError(res.status, data?.error ?? "Request failed");
  return data as T;
}

// ---- Types ----

export interface TenantSummary {
  id: string;
  name: string;
  status: "onboarding" | "live";
  auth_method: string;
  workflow_count: string;
  user_count: string;
}

export interface TenantDetail {
  id: string;
  name: string;
  status: string;
  auth_method: string;
  notification_channel: string;
}

export interface Role {
  id: string;
  name: string;
  hierarchy_level: number;
}

export interface TenantUser {
  id: string;
  email: string;
  role_id: string | null;
  is_tenant_admin: boolean;
  is_active: boolean;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface WorkflowField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export interface ApprovalStepTemplate {
  id: string;
  stage_order: number;
  role_id: string;
  role_name: string;
  assignment_mode: "named" | "pooled";
  condition: { field: string; operator: string; value: unknown } | null;
  assignees: { userId: string; email: string }[];
}

// ---- API ----

export const platformApi = {
  login: (email: string, password: string) =>
    request<{ token: string }>("POST", "/platform-auth/login", { email, password }),

  listTenants: () => request<TenantSummary[]>("GET", "/admin/tenants"),
  getTenant: (tenantId: string) => request<TenantDetail>("GET", `/admin/tenants/${tenantId}`),
  createTenant: (body: { name: string; authMethod: string; notificationChannel: string }) =>
    request<{ id: string }>("POST", "/admin/tenants", body),
  launchTenant: (tenantId: string) =>
    request<{ status: string }>("POST", `/admin/tenants/${tenantId}/launch`),

  listRoles: (tenantId: string) =>
    request<Role[]>("GET", `/admin/tenants/${tenantId}/roles`),
  createRole: (tenantId: string, body: { name: string; hierarchyLevel: number }) =>
    request<{ id: string }>("POST", `/admin/tenants/${tenantId}/roles`, body),

  listUsers: (tenantId: string) =>
    request<TenantUser[]>("GET", `/admin/tenants/${tenantId}/users`),
  createUser: (
    tenantId: string,
    body: { email: string; password: string; roleId?: string; isTenantAdmin?: boolean }
  ) => request<{ id: string }>("POST", `/admin/tenants/${tenantId}/users`, body),

  listWorkflows: (tenantId: string) =>
    request<WorkflowSummary[]>("GET", `/admin/tenants/${tenantId}/workflows`),
  createWorkflow: (
    tenantId: string,
    body: { name: string; description: string; fields: WorkflowField[]; requiredDocuments: string[] }
  ) => request<{ id: string }>("POST", `/admin/tenants/${tenantId}/workflows`, body),

  listApprovalSteps: (tenantId: string, workflowId: string) =>
    request<ApprovalStepTemplate[]>(
      "GET",
      `/admin/tenants/${tenantId}/workflows/${workflowId}/approval-steps`
    ),
  createApprovalStep: (
    tenantId: string,
    workflowId: string,
    body: {
      stageOrder: number;
      roleId: string;
      assignmentMode: "named" | "pooled";
      condition?: { field: string; operator: string; value: unknown } | null;
      assigneeUserIds?: string[];
    }
  ) =>
    request<{ id: string }>(
      "POST",
      `/admin/tenants/${tenantId}/workflows/${workflowId}/approval-steps`,
      body
    ),
};
