# Pre-Production Auth Checklist

Use this checklist to move from local testing to secure production auth.

## 1) Environment Profiles

Set these values by environment:

| Variable | Local/Dev | Staging (private) | Production |
|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` |
| `DEMO_OTP_PREVIEW` | `true` | `false` (recommended) | `false` |
| `AUTH_DIAGNOSTICS` | `true` while debugging | `false` | `false` |
| `BETTER_AUTH_SECRET` | set (dev-safe) | strong secret | strong secret |
| `BETTER_AUTH_URL` | local URL | staging URL | production URL |
| `NEXT_PUBLIC_APP_URL` | local URL | staging URL | production URL |
| `DATABASE_URL` | local DB | staging DB | production DB |

## 2) Before Staging

- [ ] `bun run db:generate`
- [ ] `bun run db:deploy` (or `bunx prisma migrate deploy`)
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] Verify login with:
  - [ ] email + password
  - [ ] phone + password
  - [ ] 2FA verify
  - [ ] logout/login round-trip

## 3) Staging Verification

- [ ] Test role login/access:
  - [ ] `SACCO_ADMIN`
  - [ ] `CHAIRPERSON`
  - [ ] `BOARD_MEMBER`
  - [ ] `TREASURER`
  - [ ] `LOAN_OFFICER`
  - [ ] `AUDITOR`
  - [ ] `MEMBER`
- [ ] Confirm protected routes do not load without session
- [ ] Confirm protected routes reject invalid role actions
- [ ] Confirm 2FA is required when `DEMO_OTP_PREVIEW=false`
- [ ] Confirm OTP resend + verify works consistently

## 4) Security Hardening Before Production

- [ ] Disable demo OTP:
  - [ ] `DEMO_OTP_PREVIEW=false` (or unset)
- [ ] Disable diagnostics:
  - [ ] `AUTH_DIAGNOSTICS=false` (or unset)
- [ ] Rotate all temporary/demo passwords
- [ ] Revoke all active sessions after rotation
- [ ] Ensure auth cookies are secure in production
- [ ] Confirm no OTP codes are logged to public/shared logs

## 5) Production Go-Live Steps

- [ ] Backup production database
- [ ] Apply migrations (`prisma migrate deploy`)
- [ ] Deploy app
- [ ] Run smoke checks:
  - [ ] sign in + 2FA
  - [ ] dashboard access by role
  - [ ] loan apply/approve/disburse/repay
  - [ ] member search/edit
  - [ ] savings/shares flows
  - [ ] exports + audit logs
- [ ] Monitor first 30 minutes:
  - [ ] auth failures
  - [ ] 401/403 rates
  - [ ] API error rate

## 6) Post-Go-Live

- [ ] Remove any temporary test accounts not needed
- [ ] Enforce periodic password resets for privileged users
- [ ] Document emergency access + session revocation procedure
