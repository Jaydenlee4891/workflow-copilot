-- Seed data for Workflow Copilot
-- Two tenants, deliberately built to exercise every mechanism in the model:
--   Acme Corp (commercial, password auth)  -> Expense Reimbursement workflow
--     - sequential stage (Manager)
--     - parallel stage (Finance Reviewer + Department Head, same stage_order)
--     - conditional stage (Director, only if amount > 10000)
--   1st Battalion (military, CAC auth)     -> CHCR Request workflow
--     - purely sequential chain (CC -> BN S4 -> BDE S4)
--     - pooled assignment mode on the BN S4 step

BEGIN;

-- ---------- Platform staff ----------
INSERT INTO platform_admins (id, email, password_hash) VALUES
('00000000-0000-0000-0000-000000000001', 'onboarding@workflowcopilot.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS'); -- real bcrypt hash of 'password123'

-- ---------- Tenants ----------
INSERT INTO tenants (id, name, auth_method, notification_channel, notification_config, status, created_by) VALUES
('11111111-1111-1111-1111-111111111111', 'Acme Corp', 'password', 'teams',
   '{"webhook_url": "https://acme.webhook.office.com/placeholder"}', 'live', '00000000-0000-0000-0000-000000000001'),
('22222222-2222-2222-2222-222222222222', '1st Battalion', 'cac', 'email',
   '{"domain": "1stbn.mil"}', 'live', '00000000-0000-0000-0000-000000000001');

-- ---------- Roles ----------
INSERT INTO roles (id, tenant_id, name, hierarchy_level) VALUES
('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Manager', 2),
('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Finance Reviewer', 2),
('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Department Head', 2),
('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Director', 1),
('a0000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Employee', 3),
('b0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Company Commander', 3),
('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'BN S4', 2),
('b0000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'BDE S4', 1),
('b0000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Soldier', 4);

-- ---------- Users ----------
-- Acme: password auth. All real bcrypt hashes of 'password123' for backend testing.
INSERT INTO users (id, tenant_id, email, password_hash, role_id, is_tenant_admin) VALUES
('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'jane@acme.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS', 'a0000000-0000-0000-0000-000000000005', false),
('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'manager.bob@acme.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS', 'a0000000-0000-0000-0000-000000000001', false),
('a1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'finance.fran@acme.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS', 'a0000000-0000-0000-0000-000000000002', false),
('a1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'depthead.dana@acme.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS', 'a0000000-0000-0000-0000-000000000003', false),
('a1000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'director.dan@acme.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS', 'a0000000-0000-0000-0000-000000000004', false),
('a1000000-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'admin.alice@acme.com', '$2a$10$3lcbZhG9W960Pdn3htSQouqlSPs097TZWjbsq9SimO/m3.BueiLpS', 'a0000000-0000-0000-0000-000000000005', true);

-- Battalion: CAC auth (no password_hash, cac_id populated instead)
INSERT INTO users (id, tenant_id, email, cac_id, role_id, is_tenant_admin) VALUES
('b1000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'spc.requester@1stbn.mil', '1234567890', 'b0000000-0000-0000-0000-000000000004', false),
('b1000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'cpt.smith@1stbn.mil', '1234567891', 'b0000000-0000-0000-0000-000000000001', false),
('b1000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'sfc.jones@1stbn.mil', '1234567892', 'b0000000-0000-0000-0000-000000000002', false),
('b1000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'ssg.lee@1stbn.mil', '1234567893', 'b0000000-0000-0000-0000-000000000002', false),
('b1000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', 'maj.patel@1stbn.mil', '1234567894', 'b0000000-0000-0000-0000-000000000003', false);

-- ---------- Workflows ----------
INSERT INTO workflows (id, tenant_id, name, description, fields, required_documents, created_by) VALUES
('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Expense Reimbursement',
  'Reimbursement for business expenses',
  '[{"id":"amount","label":"Amount","type":"number","required":true},{"id":"description","label":"Description","type":"text","required":true}]',
  '["Receipt"]',
  '00000000-0000-0000-0000-000000000001'),
('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'CHCR Request',
  'Commercial/Hired vehicle transportation support',
  '[{"id":"missionName","label":"Mission Name","type":"text","required":true},{"id":"missionDate","label":"Mission Date","type":"date","required":true},{"id":"poc","label":"POC","type":"text","required":true},{"id":"vehicleCount","label":"Vehicle Count","type":"number","required":true}]',
  '["Mission Memo", "Risk Assessment", "Driver Roster"]',
  '00000000-0000-0000-0000-000000000001');

-- ---------- Workflow approval step templates ----------
-- Expense Reimbursement: sequential (1) -> parallel (2,2) -> conditional (3)
INSERT INTO workflow_approval_steps (id, workflow_id, stage_order, role_id, assignment_mode, condition) VALUES
('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 1, 'a0000000-0000-0000-0000-000000000001', 'named', NULL),
('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 2, 'a0000000-0000-0000-0000-000000000002', 'named', NULL),
('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 2, 'a0000000-0000-0000-0000-000000000003', 'named', NULL),
('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 3, 'a0000000-0000-0000-0000-000000000004', 'named',
   '{"field": "amount", "operator": ">", "value": 10000}');

-- CHCR: purely sequential, middle step pooled
INSERT INTO workflow_approval_steps (id, workflow_id, stage_order, role_id, assignment_mode, condition) VALUES
('d1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 1, 'b0000000-0000-0000-0000-000000000001', 'named', NULL),
('d1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 2, 'b0000000-0000-0000-0000-000000000002', 'pooled', NULL),
('d1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 3, 'b0000000-0000-0000-0000-000000000003', 'named', NULL);

-- ---------- Workflow approval step assignees ----------
INSERT INTO workflow_approval_step_assignees (workflow_approval_step_id, user_id) VALUES
('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002'), -- Manager -> Bob
('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000003'), -- Finance -> Fran
('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000004'), -- Dept Head -> Dana
('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000005'), -- Director -> Dan
('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002'), -- CC -> CPT Smith
('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003'), -- BN S4 pool -> SFC Jones
('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000004'), -- BN S4 pool -> SSG Lee
('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000005'); -- BDE S4 -> MAJ Patel

-- ---------- Requests ----------
-- req_A: under the $10k threshold -> Director step should NOT be cloned
INSERT INTO requests (id, tenant_id, workflow_id, requester_id, field_values, status, current_stage_order) VALUES
('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '{"amount": 500, "description": "Team lunch"}', 'in_review', 1);

-- req_B: over the $10k threshold -> Director step SHOULD be cloned; stage 1 already approved
INSERT INTO requests (id, tenant_id, workflow_id, requester_id, field_values, status, current_stage_order) VALUES
('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001', '{"amount": 15000, "description": "Conference travel"}', 'in_review', 2);

-- req_C: CHCR request, currently waiting on the Company Commander
INSERT INTO requests (id, tenant_id, workflow_id, requester_id, field_values, status, current_stage_order) VALUES
('f0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'd0000000-0000-0000-0000-000000000001',
  'b1000000-0000-0000-0000-000000000001', '{"missionName": "Range Qualification", "missionDate": "2026-07-10", "poc": "SPC Requester", "vehicleCount": 3}', 'in_review', 1);

-- ---------- Request documents ----------
INSERT INTO request_documents (request_id, document_label, storage_key, uploaded_by) VALUES
('e0000000-0000-0000-0000-000000000001', 'Receipt', 'acme-corp/req-a/receipt.pdf', 'a1000000-0000-0000-0000-000000000001'),
('f0000000-0000-0000-0000-000000000001', 'Mission Memo', '1st-battalion/req-c/mission-memo.pdf', 'b1000000-0000-0000-0000-000000000001');

-- ---------- Request approval step instances ----------
-- req_A (amount=500): condition not met, so only stages 1 and 2 exist. All pending (freshly submitted).
INSERT INTO request_approval_steps (id, request_id, stage_order, role_id, assignment_mode, assigned_to, status) VALUES
('11000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 1, 'a0000000-0000-0000-0000-000000000001', 'named', 'a1000000-0000-0000-0000-000000000002', 'pending'),
('11000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 2, 'a0000000-0000-0000-0000-000000000002', 'named', 'a1000000-0000-0000-0000-000000000003', 'pending'),
('11000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001', 2, 'a0000000-0000-0000-0000-000000000003', 'named', 'a1000000-0000-0000-0000-000000000004', 'pending');

-- req_B (amount=15000): condition met, all 4 steps exist. Stage 1 already approved, stage 2 in progress (parallel, both pending).
INSERT INTO request_approval_steps (id, request_id, stage_order, role_id, assignment_mode, assigned_to, status, comments, decided_at) VALUES
('22000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 1, 'a0000000-0000-0000-0000-000000000001', 'named', 'a1000000-0000-0000-0000-000000000002', 'approved', 'Approved - within budget', now());
INSERT INTO request_approval_steps (id, request_id, stage_order, role_id, assignment_mode, assigned_to, status) VALUES
('22000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 2, 'a0000000-0000-0000-0000-000000000002', 'named', 'a1000000-0000-0000-0000-000000000003', 'pending'),
('22000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', 2, 'a0000000-0000-0000-0000-000000000003', 'named', 'a1000000-0000-0000-0000-000000000004', 'pending'),
('22000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', 3, 'a0000000-0000-0000-0000-000000000004', 'named', 'a1000000-0000-0000-0000-000000000005', 'pending');

-- req_C (CHCR): sequential, currently at stage 1. Stage 2's assigned_to is NULL -> unclaimed pooled step.
INSERT INTO request_approval_steps (id, request_id, stage_order, role_id, assignment_mode, assigned_to, status) VALUES
('33000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 1, 'b0000000-0000-0000-0000-000000000001', 'named', 'b1000000-0000-0000-0000-000000000002', 'pending'),
('33000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001', 2, 'b0000000-0000-0000-0000-000000000002', 'pooled', NULL, 'pending'),
('33000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 3, 'b0000000-0000-0000-0000-000000000003', 'named', 'b1000000-0000-0000-0000-000000000005', 'pending');

-- ---------- Audit log ----------
INSERT INTO audit_log (tenant_id, actor_id, action, target_type, target_id, metadata) VALUES
('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000001', 'request.submitted', 'request', 'e0000000-0000-0000-0000-000000000001', '{"workflow": "Expense Reimbursement"}'),
('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000001', 'request.submitted', 'request', 'e0000000-0000-0000-0000-000000000002', '{"workflow": "Expense Reimbursement"}'),
('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000002', 'approval.approved', 'request_approval_step', '22000000-0000-0000-0000-000000000001', '{"comments": "Approved - within budget"}'),
('22222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000001', 'request.submitted', 'request', 'f0000000-0000-0000-0000-000000000001', '{"workflow": "CHCR Request"}');

COMMIT;
