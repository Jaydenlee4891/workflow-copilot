# Workflow Copilot

A multi-tenant SaaS platform for configurable approval workflows — the kind of system used to route requests (expense reimbursements, equipment requests, administrative approvals) through an organization's chain of sign-off, with forms, document checklists, and automatic handling of personnel changes.

Built as a full-stack system from the database up: PostgreSQL with row-level security, a Node/Express/TypeScript API, and a React/TypeScript frontend, packaged to run with a single `docker compose up`.

> **Why this project exists:** I built this to understand, end to end, how a real production-shaped web application is architected — not a tutorial clone, but a system with genuine multi-tenancy, a non-trivial state machine, a real authorization model, and a deployment story. The most interesting parts of this README are the **architecture** and **key design decisions** sections, because they explain the *reasoning*, not just the result.

---

## What it does

- **Multiple customer organizations** ("tenants") share one running system, with their data rigorously isolated from each other.
- Each organization configures its own **workflows** — a workflow defines a form (what information to collect), a document checklist, and an **approval chain** (who signs off, in what order).
- Approval chains support **sequential** steps, **parallel** steps (multiple approvers at the same stage, all required), and **conditional** steps (e.g. a director only signs off if the amount exceeds a threshold).
- Approvers can be **named** (a specific person) or **pooled** (anyone in a group can claim the task).
- When someone **leaves the organization**, their in-flight approvals are automatically reassigned and they're removed from future eligibility — immediately, without waiting on another approval.
- A separate **platform-admin** role can onboard new organizations through a guided wizard (define roles, users, workflows, and approval chains, then launch).

---

## Architecture

The system is three separate layers, each with one job, and — critically — **they don't trust each other**:

```
┌─────────────────────────────────────────────┐
│  FRONTEND  (React, runs in the browser)      │   experience, not enforcement
└───────────────────────┬─────────────────────┘
                        │  HTTP
┌───────────────────────▼─────────────────────┐
│  BACKEND  (Node/Express, runs on a server)   │   the only layer that enforces rules
└───────────────────────┬─────────────────────┘
                        │  SQL
┌───────────────────────▼─────────────────────┐
│  DATABASE  (PostgreSQL)                      │   the source of truth
└─────────────────────────────────────────────┘
```

The frontend runs on the user's machine, so it can be tampered with — which means **it cannot be trusted to enforce anything**. Every security and correctness rule lives in the backend or the database. The frontend's job is purely to present a usable interface; the backend independently re-checks every permission regardless of what the frontend believes.

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 16 (row-level security for tenant isolation) |
| Backend | Node.js, Express, TypeScript |
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Auth | JWT (separate token types for tenant users vs. platform admins) |
| Storage | Filesystem behind a swappable `StorageBackend` interface |
| Deployment | Docker Compose (Postgres + backend + frontend) |

---

## Key design decisions

This is the part worth reading. Each of these was a deliberate choice with a reason.

### Multi-tenancy enforced at the database layer, not in application code

Many SaaS systems keep tenants separate by adding `WHERE tenant_id = ...` to every query in application code. That works until a developer forgets it once — and then one query leaks every customer's data. That's one of the most common catastrophic bugs in real SaaS.

Instead, isolation here is enforced by **PostgreSQL Row-Level Security**. The database itself is configured so that every query is automatically filtered to the current tenant's rows. A developer *cannot* write a query that leaks across tenants, because the database refuses to return the other rows — even if the `WHERE` clause is forgotten.

The design philosophy: **make the safe thing automatic and the dangerous thing impossible**, rather than relying on developers to remember. And it **fails closed** — a query with no tenant context returns nothing and errors, rather than returning everything.

### A single integer expresses both sequential and parallel approval

Each approval step has a `stage_order` number. Steps with the *same* number run in parallel (all must approve to advance); steps with *different* numbers run in sequence. One simple primitive covers both cases, instead of separate machinery for "parallel" and "sequential."

### Template vs. instance for the approval engine

A workflow's approval chain is a **template** (the blueprint, defined once). When a request is actually submitted, the relevant steps are **copied** onto that specific request as a live instance that tracks its own progress. This means a request in flight isn't affected if the template changes later — it's a snapshot of the rules at submission time. (This is the same class/object, recipe/meal distinction that shows up throughout software.)

### Draft-first request creation

A request is created in `draft` status the moment the user opens the form — so documents have a real request to attach to *before* submission. Submitting promotes the draft to `in_review` and clones the approval steps. Abandoned drafts are cleaned up automatically after a configurable window (default 30 days).

### Separate identity for platform staff

The company running the platform is not a tenant. Platform admins have their own role, their own token type, and connect to the database through a separate, more privileged path that tenant-facing code can never reach. A bug in tenant code cannot escalate into platform-admin access.

---

## Bugs found by testing against reality

A recurring theme of this project: **code that looks correct and code that is correct are different things, and the only bridge between them is running it.** Several real bugs surfaced *only* through execution, not inspection:

- **An authorization gap:** both token types (tenant user and platform admin) were signed with the same secret, and the middleware initially checked only that a token was *genuine*, not what *type* it was — so a normal user's valid token could authenticate as a platform admin. Fixed by validating the token's payload shape, not just its signature. *Found by deliberately trying the cross-type request.*
- **A data-serialization bug:** the Postgres driver serializes JS objects to JSON automatically, but **not arrays** — it converts them to Postgres array-literal syntax, which is invalid JSON for a `jsonb` column. Workflow `fields` and `requiredDocuments` are arrays, so they needed explicit handling. *Found when workflow creation failed against a real database.*
- **A process-crashing gap:** Express 4 does not catch rejected promises from async route handlers, and Node terminates the process on an unhandled rejection — so one malformed request could take down the whole server for every tenant. Fixed with a wrapper applied to every route. *Found when one bad request crashed the server during testing.*

The system includes test suites that walk the full lifecycle — submit, approve, reject, claim, departure-reassignment, onboarding, and document upload — exercising the engine against a real database rather than mocks.

---

## Running it

Requires Docker with Compose. From the project root:

```bash
docker compose up
```

Then open **http://localhost:8080**.

**Demo logins** (seeded data):

- Tenant user — tenant ID `11111111-1111-1111-1111-111111111111`, `jane@acme.com` / `password123`
- Platform admin — at `/admin/login`, `onboarding@workflowcopilot.com` / `password123`

To reset everything and re-seed: `docker compose down -v && docker compose up`.

A manual setup path (running Postgres, backend, and frontend separately) is documented in `GETTING_STARTED.md`.

> **Note on the demo configuration:** the seeded data, default passwords, and `JWT_SECRET` in this package are for local demonstration only. They are deliberately insecure and documented as such — this is configured to *run and be explored easily*, not to hold real data. Production hardening (real secrets management, HTTPS, backups, SSO) is intentionally out of scope for this build.

---

## Project structure

```
.
├── docker-compose.yml      # brings up all three services
├── db/                     # schema + seed (auto-loaded on first DB boot)
├── backend/
│   └── src/
│       ├── routes/         # API endpoints, grouped by responsibility
│       ├── middleware/     # reusable request checkpoints (auth, etc.)
│       ├── db.ts           # database access + the tenant-scoping mechanism
│       ├── auth.ts         # tokens, password hashing
│       └── storage.ts      # file storage behind a swappable interface
└── frontend/
    └── src/
        ├── pages/          # full screens
        ├── components/     # reusable UI pieces
        ├── api/            # all backend communication, in one place
        └── platform/       # the platform-admin onboarding tool
```

The organizing principle, applied at every level: **group code by responsibility, so each piece is small, findable, and isolated from changes to its neighbors.**

---

## Scope: what's built and what's deliberately deferred

Built and working:

- Full multi-tenant data model with row-level security
- Complete request lifecycle (draft → submit → approve/reject/claim) with sequential, parallel, and conditional approval
- Departure-triggered automatic reassignment
- Document upload/download
- Platform-admin onboarding wizard (create and launch a tenant end to end)
- Tenant admin panel (roster, assignment editing, departures)
- Docker deployment package

Deliberately deferred (and *why*):

- **AI assistant** — a planned read-only assistant that answers questions about a user's own requests and workflows, grounded in their actual (tenant-scoped) data. Designed to be strictly informational, never able to *take* actions, since an AI that can approve or modify records is a security and correctness risk. *(Next planned addition — see below.)*
- **Single sign-on / CAC authentication** — the auth layer currently uses email/password; enterprise SSO and government CAC are designed-for but not implemented.
- **Object storage (S3)** — storage is filesystem-backed behind an interface, so swapping in S3-compatible storage means adding one implementation, not rewriting routes.
- **Production hardening** — secrets management, HTTPS, backups, monitoring. Out of scope for a demonstration build.

This honest accounting is intentional: the deferred items were *choices*, made to keep the build focused on demonstrating architecture rather than chasing completeness.

---

## Roadmap

- [ ] AI assistant (read-only, tenant-scoped, grounded in the user's own data)
- [ ] SSO / CAC authentication
- [ ] S3-compatible object storage implementation
- [ ] Reporting and analytics dashboards
- [ ] Notification dispatch (email / chat integrations)
