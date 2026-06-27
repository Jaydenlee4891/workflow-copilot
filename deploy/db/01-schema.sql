-- Workflow Copilot — Data Model (PostgreSQL)
-- Companion to workflow-copilot-spec-v2.md
--
-- Design notes:
-- 1. Multi-tenancy: every tenant-scoped table carries tenant_id. Row-level
--    security (RLS) should be enabled on these tables in production so that
--    tenant isolation is enforced by the database, not just application code.
--    An example policy is included at the bottom of this file.
-- 2. JSONB is used deliberately for workflow "fields" and "required_documents"
--    because these are the explicitly configurable, no-code parts of the
--    system (a workflow's shape varies per tenant per service). Everything
--    that needs to be queried, joined, or audited as state (requests,
--    approval steps) is modeled as real relational rows instead.
-- 3. Assignment changes (who is assigned to a workflow step) are NOT a
--    separate table/feature. They go through the same Request /
--    RequestApprovalStep machinery as any other service — see spec
--    Section 10. A "change assignment" request just targets a
--    workflow_approval_step_id in its field_values instead of mission data.
-- 4. Approval chains support sequential, parallel, and conditional
--    structures via stage_order + condition on workflow_approval_steps
--    (see that table's comment below) — not just a strict linear list. A
--    purely sequential chain is simply the case where every step has its
--    own unique stage_order, e.g. the CHCR example: CC=1, BN S4=2, BDE S4=3.
-- 5. Personnel departures reassign in-flight pending steps automatically
--    (see request_approval_steps comment) — this is separate from, and
--    not gated behind, the team-lead/manager assignment-change workflow.
--    Structural changes to a chain itself (stages added/removed/reordered
--    while requests are in flight) are a distinct, still-open question.

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ============================================================
-- Platform staff (NOT tenant-scoped — internal team only)
-- ============================================================

CREATE TABLE platform_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Tenants
-- ============================================================

CREATE TABLE tenants (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT NOT NULL,
    auth_method             TEXT NOT NULL DEFAULT 'password', -- 'password' | 'cac'
    notification_channel    TEXT NOT NULL DEFAULT 'email',    -- 'email' | 'teams' | 'slack'
    notification_config     JSONB,                            -- channel-specific settings (webhook url, etc.)
    status                  TEXT NOT NULL DEFAULT 'onboarding', -- 'onboarding' | 'live'
    created_by              UUID REFERENCES platform_admins(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Roles (tenant-defined position hierarchy)
-- ============================================================

CREATE TABLE roles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    name                TEXT NOT NULL,        -- e.g. "Company Commander", "Team Lead"
    hierarchy_level     INT NOT NULL,         -- lower = more senior (convention; enforce in app logic)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX idx_roles_tenant ON roles (tenant_id);

-- ============================================================
-- Users (tenant-scoped)
-- ============================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    email               TEXT NOT NULL,
    password_hash       TEXT,                 -- null if tenant.auth_method = 'cac'
    cac_id              TEXT,                 -- null unless tenant.auth_method = 'cac'
    role_id             UUID REFERENCES roles(id),
    is_tenant_admin     BOOLEAN NOT NULL DEFAULT false,
    is_active           BOOLEAN NOT NULL DEFAULT true, -- false once departed; triggers reassignment, see request_approval_steps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users (tenant_id);

-- ============================================================
-- Workflows (service definitions — created only by platform_admins)
-- ============================================================

CREATE TABLE workflows (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id),
    name                    TEXT NOT NULL,                -- e.g. "CHCR Request"
    description             TEXT,
    fields                  JSONB NOT NULL DEFAULT '[]',  -- [{id, label, type, required}, ...]
    required_documents      JSONB NOT NULL DEFAULT '[]',  -- ["Mission Memo", "Risk Assessment", ...]
    is_active               BOOLEAN NOT NULL DEFAULT true,
    created_by              UUID NOT NULL REFERENCES platform_admins(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_tenant ON workflows (tenant_id);

-- Approval chain TEMPLATE for a workflow. Each row is one approval
-- requirement (a "step") for a given role. Multiple steps can share the
-- same stage_order — those run in PARALLEL, and all of them must be
-- approved before the request advances past that stage. Give each step
-- its own stage_order for a purely sequential chain.
--
-- `condition` is optional: if set, this step only applies to a request
-- when the condition evaluates true against that request's field_values
-- (e.g. {"field": "amount", "operator": ">", "value": 10000}). If null,
-- the step always applies. Conditions are evaluated once, when a request
-- is submitted and its steps are cloned into request_approval_steps.
--
-- Two distinct uses: (1) an optional extra step layered onto an otherwise
-- fixed chain (the amount example above), or (2) several mutually
-- exclusive steps at the same stage_order, each with a different
-- condition, used to route to the right approver depending on the
-- request's own data — e.g. the Assignment Change workflow (spec Section
-- 10) has one stage-1 step per team, each gated on target_role_id, so
-- exactly one is ever cloned per request. Usage (2) means a request whose
-- data matches no configured condition gets zero steps at that stage —
-- validate at the application layer before allowing submission, since an
-- unroutable request fails silently otherwise.
CREATE TABLE workflow_approval_steps (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id         UUID NOT NULL REFERENCES workflows(id),
    stage_order         INT NOT NULL,
    role_id             UUID NOT NULL REFERENCES roles(id),
    assignment_mode     TEXT NOT NULL DEFAULT 'named', -- 'named' | 'pooled'
    condition           JSONB, -- null = always applies
    UNIQUE (workflow_id, stage_order, role_id)
);

-- Who currently fills a given workflow approval step:
-- one row per eligible user. 'named' mode = exactly one (or a small fixed
-- set); 'pooled' mode = every qualified team member. Same table serves both
-- modes, no separate mechanism needed.
CREATE TABLE workflow_approval_step_assignees (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_approval_step_id       UUID NOT NULL REFERENCES workflow_approval_steps(id),
    user_id                         UUID NOT NULL REFERENCES users(id),
    UNIQUE (workflow_approval_step_id, user_id)
);

-- ============================================================
-- Requests (a submitted instance of a workflow)
-- ============================================================

CREATE TABLE requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    workflow_id         UUID NOT NULL REFERENCES workflows(id),
    requester_id        UUID NOT NULL REFERENCES users(id),
    field_values        JSONB NOT NULL DEFAULT '{}',  -- matches workflow.fields shape
    status              TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'in_review' | 'approved' | 'rejected'
    current_stage_order INT NOT NULL DEFAULT 1,        -- the stage currently awaiting approval
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_requests_tenant ON requests (tenant_id);
CREATE INDEX idx_requests_requester ON requests (requester_id);

-- Documents uploaded against a request (points to S3-compatible storage)
CREATE TABLE request_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          UUID NOT NULL REFERENCES requests(id),
    document_label      TEXT NOT NULL,   -- matches an entry in workflow.required_documents
    storage_key         TEXT NOT NULL,   -- S3 object key
    uploaded_by         UUID NOT NULL REFERENCES users(id),
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_request_documents_request ON request_documents (request_id);

-- Per-request approval step INSTANCES — the actual tracked state, distinct
-- from the workflow's template (workflow_approval_steps above). Cloned
-- from the template when a request is submitted; only steps whose
-- condition evaluated true (or had none) are cloned. Multiple rows
-- sharing the same stage_order run in parallel: the request only advances
-- past that stage once every row at it is 'approved'. If any one of them
-- is rejected, the request is rejected (no partial-approval state) — this
-- is app logic, not enforced by the schema.
--
-- assigned_to is the one piece of instance state that is NOT frozen at
-- clone time: if a user departs (users.is_active set false), the backend
-- immediately (a) deletes their workflow_approval_step_assignees rows
-- tenant-wide, so they stop being eligible for any future request, named
-- or pooled, and (b) reassigns their currently pending steps — pooled
-- steps revert to unclaimed (assigned_to = NULL, back to the remaining
-- pool); named steps reassign to whoever now holds that
-- workflow_approval_step's named assignment (found via request.workflow_id
-- + stage_order + role_id against workflow_approval_step_assignees, after
-- step (a) so the departed person can never be found as their own
-- replacement), or are left assigned_to = NULL if no replacement has been
-- designated yet — distinguishable from a pooled-unclaimed NULL because
-- assignment_mode still reads 'named' on that row, so it isn't claimable
-- by just anyone. This is system-triggered, not routed through the
-- team-lead / manager assignment-change workflow (spec Section 10) — the
-- entire point of automatic reassignment is to remove the bottleneck a
-- departure would otherwise cause. Recorded in audit_log as
-- 'approval_step.reassigned' and 'user.departed'.
-- assignment_mode is copied from the template at clone time so this logic
-- doesn't require a join back to the (possibly since-changed) template.
CREATE TABLE request_approval_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID NOT NULL REFERENCES requests(id),
    stage_order     INT NOT NULL,
    role_id         UUID NOT NULL REFERENCES roles(id),
    assignment_mode TEXT NOT NULL, -- 'named' | 'pooled', snapshot from the template
    assigned_to     UUID REFERENCES users(id), -- null until claimed (pooled) or until reassigned (named, departure)
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    comments        TEXT,
    decided_at      TIMESTAMPTZ,
    UNIQUE (request_id, stage_order, role_id)
);

CREATE INDEX idx_request_approval_steps_request ON request_approval_steps (request_id);
CREATE INDEX idx_request_approval_steps_assignee ON request_approval_steps (assigned_to);

-- ============================================================
-- Audit log (append-only)
-- ============================================================

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    actor_id        UUID REFERENCES users(id), -- null if action was system/platform-admin initiated
    action          TEXT NOT NULL,             -- e.g. 'request.submitted', 'approval.approved'
    target_type     TEXT NOT NULL,             -- 'request' | 'workflow' | 'workflow_approval_step' | ...
    target_id       UUID,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_tenant ON audit_log (tenant_id);

-- ============================================================
-- Row-level security
-- ============================================================
-- Tables with a direct tenant_id column get a direct policy. Tables
-- without one (child rows of a tenant-scoped parent) get scoped via a
-- subquery against their parent. platform_admins is NOT included here —
-- it isn't tenant-scoped at all, and the application role below is never
-- granted access to it; platform-staff-only endpoints are expected to use
-- a separate, more privileged connection, not this role.

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_roles ON roles
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflows ON workflows
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_requests ON requests
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_audit_log ON audit_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Child tables: no tenant_id of their own, scoped via their parent.
ALTER TABLE workflow_approval_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_approval_steps ON workflow_approval_steps
    USING (workflow_id IN (SELECT id FROM workflows WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

ALTER TABLE workflow_approval_step_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_workflow_approval_step_assignees ON workflow_approval_step_assignees
    USING (workflow_approval_step_id IN (
        SELECT was.id FROM workflow_approval_steps was
        JOIN workflows w ON w.id = was.workflow_id
        WHERE w.tenant_id = current_setting('app.current_tenant_id')::UUID
    ));

ALTER TABLE request_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_request_documents ON request_documents
    USING (request_id IN (SELECT id FROM requests WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

ALTER TABLE request_approval_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_request_approval_steps ON request_approval_steps
    USING (request_id IN (SELECT id FROM requests WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

-- Application sets app.current_tenant_id at the start of each request
-- (e.g. SELECT set_config('app.current_tenant_id', $1, true); — note this
-- is the set_config() FUNCTION, not the SET command: SET does not accept
-- bind parameters, so set_config() is the only injection-safe way to do
-- this from application code) based on the authenticated user's tenant.

-- ============================================================
-- Application role
-- ============================================================
-- The backend connects as this role, never as the table-owning superuser,
-- so the policies above are actually enforced (table owners and
-- superusers bypass RLS regardless of policy). Password is a local
-- placeholder — set a real one via the deployment process, not by editing
-- this file.

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
      CREATE ROLE app_user LOGIN PASSWORD 'changeme';
   END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON
    tenants, roles, users, workflows, workflow_approval_steps,
    workflow_approval_step_assignees, requests, request_documents,
    request_approval_steps, audit_log
TO app_user;
-- DELETE is granted narrowly, only where a real feature needs it, rather
-- than broadly across every table. Currently: departure handling removes
-- a departed user's workflow_approval_step_assignees rows so they stop
-- being eligible for future requests (see request_approval_steps comment
-- above). Found by actually running the departure code against this
-- role, not by inspection — it failed with a permission error first.
GRANT DELETE ON workflow_approval_step_assignees TO app_user;
-- tenants itself has no RLS policy (a login needs to resolve which tenant
-- a user belongs to before app.current_tenant_id can even be set), so
-- access to it is restricted by column selection in application queries,
-- not by RLS.

-- ============================================================
-- Platform-admin application role
-- ============================================================
-- Separate from app_user, as promised above: a SQL-injection or logic
-- bug in tenant-facing code can never reach platform_admins, because
-- app_user is never granted access to it at all. Onboarding actions
-- (creating roles/users/workflows/chains) are still legitimately
-- tenant-scoped operations — they go through the exact same
-- withTenantContext + RLS mechanism as everything else, just connecting
-- as this role instead, which can additionally read platform_admins
-- (needed to resolve a platform-admin login, which isn't tenant-scoped
-- at all).

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'platform_admin_user') THEN
      CREATE ROLE platform_admin_user LOGIN PASSWORD 'changeme';
   END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE ON
    tenants, roles, users, workflows, workflow_approval_steps,
    workflow_approval_step_assignees, requests, request_documents,
    request_approval_steps, audit_log
TO platform_admin_user;
GRANT DELETE ON workflow_approval_step_assignees TO platform_admin_user;
GRANT SELECT ON platform_admins TO platform_admin_user;
-- The draft-cleanup job (npm run cleanup-drafts) runs as this role and
-- deletes expired draft requests plus their documents. It connects via
-- platformPool and runs per-tenant under RLS context.
GRANT DELETE ON requests, request_documents, request_approval_steps TO platform_admin_user;
