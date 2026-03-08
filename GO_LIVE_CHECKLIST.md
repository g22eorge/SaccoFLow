# SACCOFlow Go-Live Checklist

Use this checklist before enabling broad production onboarding.

## 1) Security

- [ ] Rotate `SMTP_PASS` and update `.env` / production secret manager.
- [ ] Confirm `DEMO_OTP_PREVIEW` is disabled in production.
- [ ] Confirm `AUTH_DIAGNOSTICS` is disabled in production.
- [ ] Verify 2FA email codes are delivered from approved sender domain.
- [ ] Verify webhook secrets are unique and stored securely.

## 2) Tenant Isolation

- [ ] Verify `bookings@eaglestays.ug` (platform admin) has `saccoId = null`.
- [ ] Test support tenant assumption flow from `/platform`.
- [ ] Confirm no cross-tenant leakage in members, loans, reports APIs.

Suggested checks:

```bash
bun run workflow:integrity:check
```

## 3) Billing & Subscription

- [ ] Confirm each SACCO has expected plan (`STARTER`/`TIER_2`/`TIER_3`).
- [ ] Confirm billing cycle (`MONTHLY`/`ANNUAL`) per SACCO.
- [ ] Confirm paywall behavior when trial expires.
- [ ] Confirm member-limit enforcement blocks new members at cap.

## 4) PesaPal Payment Flows

- [ ] Configure SACCO-specific payment settings:
  - `providerEnabled`
  - `merchantAccount`
  - `checkoutBaseUrl`
  - `subscriptionCallbackUrl`
  - `memberCallbackUrl`
  - `webhookSecret`
- [ ] Verify subscription checkout and webhook confirmation.
- [ ] Verify member payment intents (save, shares, loan repay) reconcile to ledger.
- [ ] Verify idempotency (duplicate webhook does not double-post).

## 5) Core Workflow UAT

- [ ] Apply -> approve -> disburse -> repay (including defaulted-to-cleared case).
- [ ] Savings and shares transactions reflect correctly in balances.
- [ ] Exports (CSV/PDF/Excel) work for target modules.
- [ ] Sidebar badges and dashboard values refresh after transactions.

## 6) Platform Operations

- [ ] Organization list loads in `/platform`.
- [ ] Suspend/reactivate organization actions work.
- [ ] Plan/cycle updates from platform console work.
- [ ] Platform profile updates work.

## 7) Build & Readiness Commands

Run all before release:

```bash
bun run lint
bun run test
bun run build
bun run auth:preprod:check --full
bun run workflow:integrity:check
```

Optional smoke run:

```bash
SMOKE_COOKIE="<session_cookie>" SMOKE_PERF_RUNS=3 bun run e2e:smoke --json
```

## 8) Rollout Plan

- [ ] Start with pilot SACCOs (2-3 organizations).
- [ ] Monitor auth failures, webhook failures, and payment reconciliation daily.
- [ ] Confirm support and rollback runbook ownership.
- [ ] Expand onboarding only after pilot stability window.

---

Release decision:

- [ ] Approved for pilot
- [ ] Approved for general production rollout
