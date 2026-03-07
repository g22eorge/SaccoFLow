# Loan Approval Workflow

This document explains how loan approvals, schedule approval, and disbursement work in SACCOFlow.

## 1) High-Level Flow

`PENDING -> APPROVED -> Waiting member approval -> DISBURSED -> ACTIVE -> CLEARED`

Exception path:

`DEFAULTED -> collections`

## 2) Single vs Dual Approval

A loan starts as `PENDING` and enters approval matrix checks.

### Single approver path

Loan can complete with one approval when:

- principal is below `approvalWorkflow.loanApprovalThreshold`, and
- risk tier is `GREEN`.

### Dual approver path

Loan requires at least two approvals when either is true:

- principal is at/above `approvalWorkflow.loanApprovalThreshold`, or
- risk tier is `AMBER` or `RED`.

The effective required count is:

- `max(baseRequiredCount, settings.approvalWorkflow.requiredApproverCount)`

So if settings force `2`, approvals remain dual even for low-risk loans.

## 3) Approval Role Groups

When dual control is required, approvals must cover required role groups.

### CREDIT group eligible roles

- `LOAN_OFFICER`
- `SACCO_ADMIN`
- `SUPER_ADMIN`
- `CHAIRPERSON`

### FINANCE group eligible roles

- `TREASURER`
- `SACCO_ADMIN`
- `SUPER_ADMIN`
- `CHAIRPERSON`

Example: if Treasurer approved first, one CREDIT-eligible approver is still needed.

## 4) What "Approval in progress (1/2)" Means

`1/2` means one valid approval step has been recorded; one more is required.

`SLA <date>` indicates the target completion deadline for matrix approval.

If SLA passes before completion:

- loan remains `PENDING`
- operations should escalate (queue follow-up)

## 5) Post-Approval and Disbursement

Once matrix approval is complete, loan moves to `APPROVED`.

Before disbursement, the system checks schedule approval:

- Member schedule approval can be present.
- GREEN auto path can auto-create schedule approval.
- Authorized staff disbursement roles can perform documented override when member schedule approval is missing.

Disbursement roles:

- `SACCO_ADMIN`
- `TREASURER`

## 6) Common Operator Scenarios

### "Approve next" says success but button doesn't switch immediately

Usually means approval was recorded but matrix is not complete yet.

Check:

- current count (`x/y`)
- missing role group coverage

### "Your approval is already recorded"

Same approver clicked again. Another eligible approver must complete the next step.

### "Waiting member approval"

Loan is approved at matrix level but schedule approval is pending.

## 7) API/Route Summary

- Apply loan: `POST /api/loans/apply`
- Approve matrix step: `POST /api/loans/[id]/approve`
- Disburse loan: `POST /api/loans/[id]/disburse`
- Repay loan: `POST /api/loans/[id]/repay`
- Member schedule approve: `POST /api/member/loans/[id]/schedule-approve`

## 8) Auditability

Approval and schedule events are written to audit logs, including:

- matrix state initialization/update
- approval steps
- auto approval/override markers
- loan status transitions

This enables review, compliance checks, and incident traceability.
