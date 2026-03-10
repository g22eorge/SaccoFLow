# Production Readiness Next Steps

## 1) Automated Smoke in CI/CD

Use the new workflow: `.github/workflows/predeploy-verify.yml`.

Required repository secrets:

- `SMOKE_BASE_URL`
- One auth option:
  - `SMOKE_COOKIE`, or
  - `SMOKE_PASSWORD` + (`SMOKE_IDENTIFIER` or `SMOKE_EMAIL`)
- Optional: `SMOKE_OTP_CODE`

This ensures every deploy candidate runs lint, tests, build, integrity checks, auth checks, and smoke checks.

## 2) PostgreSQL Migration Plan

Current app supports SQLite, but production scale should use PostgreSQL.

Recommended sequence:

1. Provision managed PostgreSQL.
2. Update `DATABASE_URL` to PostgreSQL in staging.
3. Run `bunx prisma migrate deploy` in staging.
4. Run full verification suite in staging.
5. Plan a controlled cutover window for production.
6. Enable `ENFORCE_NON_SQLITE_PRODUCTION=true` once production is on PostgreSQL.

## 3) Dependency Upgrade Strategy

Prioritize safe upgrades:

1. Patch/minor updates first (`better-auth`, `nodemailer`, etc.).
2. Prisma major upgrade (`6 -> 7`) in dedicated branch:
   - bump `prisma` and `@prisma/client`
   - regenerate client
   - run lint/test/build/migrate checks
3. Framework majors (`eslint`, other tooling) only after green staging run.

Always run:

- `bun run lint`
- `bun test --max-concurrency 1`
- `bun run build`
- `bun run workflow:integrity:check`
- `bun run auth:preprod:check --full`
- `bun run e2e:smoke`
