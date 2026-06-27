# Getting Started — Full Stack

There are two ways to run Workflow Copilot:

- **Docker (recommended)** — one command, everything wired together. See below.
- **Manual** — run Postgres, backend, and frontend yourself. See "Manual setup" further down.

---

## Docker quick start

Requires Docker with Compose. From the project root (the directory containing `docker-compose.yml`):

```bash
docker compose up
```

This starts three services: Postgres (with `schema.sql` and `seed.sql` loaded automatically on first boot), the backend API, and the frontend (nginx serving the built app and proxying API calls). Then open:

**http://localhost:8080**

- Tenant login: tenant id `11111111-1111-1111-1111-111111111111`, `jane@acme.com` / `password123`
- Platform/onboarding login (`/admin/login`): `onboarding@workflowcopilot.com` / `password123`

**Notes:**
- The database, and uploaded documents, persist in named Docker volumes across restarts. To wipe everything and re-seed from scratch: `docker compose down -v` then `docker compose up`.
- The default passwords and `JWT_SECRET` in `docker-compose.yml` are for local use. **Change them before any real deployment** (the Postgres credentials, the two app-role passwords in `schema.sql`, and `JWT_SECRET`).
- Document storage uses the local filesystem (a Docker volume) by default. The backend's storage layer is written behind a `StorageBackend` interface (`backend/src/storage.ts`), so swapping in S3-compatible object storage later means adding one implementation of that interface and pointing the app at it — no route changes.

---

## Manual setup

Database → backend → frontend, in order. Each step depends on the one before it.

### 1. Database

Requires PostgreSQL 16+.

```bash
createdb workflow_copilot
psql -d workflow_copilot -f schema.sql
psql -d workflow_copilot -f seed.sql
```

`schema.sql` creates the `app_user` application role itself (`LOGIN PASSWORD 'changeme'`) — no separate step needed for a fresh database. If you're reusing an existing one where the role already exists, set its password explicitly instead: `ALTER ROLE app_user PASSWORD 'changeme';` (or whatever you put in the backend's `DATABASE_URL` below).

**Verify the seed actually loaded correctly:**

```bash
psql -d workflow_copilot -c "SELECT email, password_hash FROM users WHERE email='jane@acme.com';"
```

The `password_hash` column must start with `$2a$` (a real bcrypt hash). If it's empty, the row doesn't exist — `seed.sql` wasn't run, or didn't run against this database. If it shows literally `bcrypt-placeholder`, you have an outdated copy of `seed.sql` from earlier in this project's history — get the current one.

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql://app_user:changeme@localhost:5432/workflow_copilot
PLATFORM_DATABASE_URL=postgresql://platform_admin_user:changeme@localhost:5432/workflow_copilot
JWT_SECRET=pick-something-real-for-anything-beyond-local-testing
PORT=3000
```

Both roles (`app_user` and `platform_admin_user`) are created by `schema.sql` — no separate setup needed.

```bash
npm run dev
```

**Verify it's actually serving:**

```bash
curl http://localhost:3000/health
```

Should return `{"ok":true}`. If this fails, the problem is the backend/database connection, not the frontend — check this terminal's output for the real error before going further.

**Verify login works independently of the frontend:**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"11111111-1111-1111-1111-111111111111","email":"jane@acme.com","password":"password123"}'
```

Should return `{"token": "..."}`. If this fails but `/health` succeeded, go back to step 1 and check Jane's stored hash.

## 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

Edit `.env` — `VITE_API_BASE_URL` must point at wherever the backend is actually running:

```
VITE_API_BASE_URL=http://localhost:3000
```

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Log in with:

| Field | Value |
|---|---|
| Tenant ID | `11111111-1111-1111-1111-111111111111` |
| Email | `jane@acme.com` |
| Password | `password123` |

## Platform admin login (onboarding tool)

The platform admin account is for Workflow Copilot staff only — used to create and configure tenant organizations. It uses a separate login endpoint and its own JWT type, deliberately distinct from tenant-user tokens.

**Login endpoint:** `POST /platform-auth/login`

```bash
curl -X POST http://localhost:3000/platform-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"onboarding@workflowcopilot.com","password":"password123"}'
```

The returned token can then call `/admin/tenants` and the onboarding wizard endpoints. It will be explicitly rejected by all tenant-user endpoints (and vice versa) — the two token types share the same signing secret but have different payload shapes, which both auth middlewares now validate explicitly.

## Troubleshooting "invalid credentials" / login fails

The login endpoint deliberately returns the same generic error for "wrong password," "user doesn't exist," and "tenant doesn't exist" — that's intentional (avoids leaking which case it is), but it means the error message itself won't tell you which step to fix. Work through it in this order:

1. **Does `curl http://localhost:3000/health` work?** If not, it's a backend/database connection problem, not a login problem. Check the backend terminal's actual error output.
2. **Does the direct `curl .../auth/login` command above succeed?** If yes, the backend and database are fine — the problem is specific to the frontend (wrong `VITE_API_BASE_URL`, or a stale build — try restarting `npm run dev`).
3. **If the curl login also fails**, check Jane's stored hash directly (step 1 above). This is the single most common cause: either the seed never loaded, or an outdated copy of `seed.sql` was used.
4. **If the hash looks correct but login still fails**, confirm `DATABASE_URL` in the backend's `.env` actually points at the database you seeded — it's easy to have multiple local Postgres databases and seed one while the backend connects to another.
