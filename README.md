# Multi-Location Waste Management API (Next.js + Prisma)

Production-grade backend API for a multi-location waste management system with strict RBAC, location scoping, JWT auth via HTTP-only cookies, standardized responses, validation, atomicity, and auditability.

Important:
- Route Handlers are public HTTP endpoints—this project uses Next.js as a Backend for Frontend (BFF) layer [^2].
- Keep secrets server-only. Do not expose process.env to the client; implement a server-only Data Access Layer (Prisma) and adhere to least-privilege principles [^1].

## Stack
- Next.js App Router (Route Handlers)
- Prisma (PostgreSQL)
- jose (JWT, HS256)
- bcryptjs (password hashing)
- zod (validation)

## Environment Variables
Create .env:
- DATABASE_URL=postgresql://user:password@host:5432/db
- JWT_SECRET="your-super-secret-key-that-is-at-least-32-characters-long"
- JWT_EXPIRES_IN="7d"
- FRONTEND_URL=http://localhost:3000

## Setup
1. Install deps and generate Prisma client:
   - npm install
   - npx prisma migrate dev
   - npx prisma db seed (or run scripts/seed.ts via ts-node)

2. Run dev:
   - npm run dev

3. Test health:
   - GET /api/health

## Auth
- POST /api/auth/login -> sets HTTP-only JWT cookie (token)
- POST /api/auth/logout -> clears cookie
- GET /api/auth/me -> current user

Cookie: HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age derived from JWT_EXPIRES_IN.

## RBAC & Scoping
- Roles: SUPERADMIN (global), ADMIN/PETUGAS/NASABAH (scoped to a single location).
- All location-scoped queries enforce where: { locationId } unless SUPERADMIN.
- Helpers: requireAuth, requireRole, enforceLocationScope.

## Endpoints Summary
- /api/locations (CRUD; create/update/delete: SUPERADMIN; list: SUPERADMIN; ADMIN returns own location)
- /api/users (CRUD with constraints)
- /api/waste/categories (CRUD; ADMIN+SUPERADMIN)
- /api/waste/transactions (create/list/get; process; cancel)
- /api/rewards (CRUD)
- /api/rewards/redeem (NASABAH)
- /api/tps3r (CRUD)
- /api/partners (CRUD)
- /api/financial-entries (CRUD)
- /api/audit-logs (list for ADMIN scoped, SUPERADMIN global)
- /api/health

## Responses
- Success: { status: "success", message, data, meta? }
- Error: { status: "error", message, details? }
HTTP status codes: 200, 201, 400, 401, 403, 404, 409, 422, 429, 500

## Validation & Errors
- zod validation for all requests, returns 422 with details.
- Prisma unique violation -> 409.
- Centralized error mapping and CORS headers.

## CORS
- Allows FRONTEND_URL; credentials enabled; methods GET,POST,PUT,DELETE,OPTIONS; handles preflight (OPTIONS).

## Rate Limiting
- In-memory bucket limiter for login. Swap to distributed storage (e.g., Upstash) in production.

## Security
- Strong passwords, bcrypt hashing.
- Minimized JWT payload with reasonable expiration; secure cookie flags.
- Audit logs for sensitive actions.
- Recommend CSP, HSTS at proxy layer.

## Observability
- Structured logs (console JSON). Add pino/winston and Sentry as needed.
- Request correlation via X-Request-ID.

## Testing & CI
- Add unit tests for helpers (auth, rbac, validators) and integration tests with a test DB.
- CI should run lint, type-check, tests, prisma migrate check.

## Prisma Schema
This repo includes a comprehensive schema aligned to the specification. If your client-provided schema differs, replace prisma/schema.prisma and regenerate. Treat your schema as the single source of truth.

## Notes
- Next.js Route Handlers power the public API endpoints in a Backend-for-Frontend pattern [^2].
- Secrets are accessed only on the server; we centralize data access and avoid leaking sensitive information, following Next.js data security guidance [^1].

Key alignments to your schema:
- Transaction model with type, locationDetail, scheduledDate, photos, actualWeight, points, notes.
- User.password stores bcrypt hashes.
- Tps3r model name and fields respected.
- RewardRedemption.pointsSpent and scoping validated against Reward.locationId.
- FinancialEntry uses FinancialEntryType and Float amount, createdByUserId filled from the authenticated user.
- AuditLog simplified; location scoping is embedded in details JSON and filtered with JSON path for ADMIN.

[^1]: https://nextjs.org/docs/app/guides/data-security
[^2]: https://nextjs.org/docs/app/guides/backend-for-frontend
