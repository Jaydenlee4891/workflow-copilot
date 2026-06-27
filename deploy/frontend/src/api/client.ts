const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Request failed");
  }
  return data as T;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  description: string;
}

export interface WorkflowField {
  id: string;
  label: string;
  type: string;
  required: boolean;
}

export interface WorkflowDetail extends WorkflowSummary {
  fields: WorkflowField[];
  required_documents: string[];
}

export interface RequestSummary {
  id: string;
  status: string;
  current_stage_order: number;
  workflow_name: string;
  field_values: Record<string, unknown>;
}

export interface ApprovalStep {
  id: string;
  stage_order: number;
  assignment_mode: "named" | "pooled";
  assigned_to: string | null;
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  decided_at: string | null;
  role_name: string;
}

export interface RequestDetail {
  id: string;
  status: string;
  current_stage_order: number;
  field_values: Record<string, unknown>;
  workflow_name: string;
  steps: ApprovalStep[];
}

export interface PendingApproval {
  step_id: string;
  stage_order: number;
  assignment_mode: "named" | "pooled";
  assigned_to: string | null;
  request_id: string;
  workflow_name: string;
}

export interface RosterAssignee {
  userId: string;
  email: string;
}

export interface RosterStep {
  stepId: string;
  stageOrder: number;
  roleName: string;
  assignmentMode: "named" | "pooled";
  assignees: RosterAssignee[];
}

export interface RosterWorkflow {
  workflowId: string;
  workflowName: string;
  steps: RosterStep[];
}

export interface TeamUser {
  id: string;
  email: string;
  is_active: boolean;
  is_tenant_admin: boolean;
  role_name: string | null;
}

export const api = {
  login: (tenantId: string, email: string, password: string) =>
    request<{ token: string }>("POST", "/auth/login", { tenantId, email, password }),

  listWorkflows: () => request<WorkflowSummary[]>("GET", "/workflows"),
  getWorkflow: (id: string) => request<WorkflowDetail>("GET", `/workflows/${id}`),

  myRequests: () => request<RequestSummary[]>("GET", "/me/requests"),
  myApprovals: () => request<PendingApproval[]>("GET", "/me/approvals"),

  createDraft: (workflowId: string, fieldValues: Record<string, unknown>) =>
    request<{ id: string }>("POST", "/requests", { workflowId, fieldValues }),
  submitDraft: (requestId: string, fieldValues: Record<string, unknown>) =>
    request("POST", `/requests/${requestId}/submit`, { fieldValues }),
  listRequestDocuments: (requestId: string) =>
    request<{ id: string; document_label: string }[]>("GET", `/requests/${requestId}/documents`),
  uploadDocument: async (requestId: string, documentLabel: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("documentLabel", documentLabel);
    const token = getToken();
    const res = await fetch(`${API_BASE}/requests/${requestId}/documents`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error ?? "Upload failed");
    return data as { id: string; documentLabel: string };
  },
  getRequest: (id: string) => request<RequestDetail>("GET", `/requests/${id}`),

  approveStep: (requestId: string, stepId: string, comments?: string) =>
    request("POST", `/requests/${requestId}/steps/${stepId}/approve`, { comments }),
  rejectStep: (requestId: string, stepId: string, comments?: string) =>
    request("POST", `/requests/${requestId}/steps/${stepId}/reject`, { comments }),
  claimStep: (requestId: string, stepId: string) =>
    request("POST", `/requests/${requestId}/steps/${stepId}/claim`),

  // Admin panel
  getRoster: () => request<RosterWorkflow[]>("GET", "/team/roster"),
  updateStepAssignees: (stepId: string, userIds: string[]) =>
    request("PATCH", `/team/roster/steps/${stepId}/assignees`, { userIds }),
  listTeamUsers: () => request<TeamUser[]>("GET", "/team/users"),
};
