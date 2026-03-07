import { requireAuth, requireSaccoContext } from "@/src/server/auth/rbac";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import { AssumeTenantBanner } from "@/src/ui/components/assume-tenant-banner";
import { BillingPaywall } from "@/src/ui/components/billing-paywall";
import { prisma } from "@/src/server/db/prisma";
import { SettingsService } from "@/src/server/services/settings.service";
import { BillingService } from "@/src/server/services/billing.service";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuth();
  const context = await requireSaccoContext();
  const { role } = context;

  if (String(role) === "PLATFORM_SUPER_ADMIN") {
    redirect("/platform");
  }

  const [pendingLoanRequests, pendingMemberRequests, defaultedCollectionCases, settings, billingAccess] = await Promise.all([
    prisma.loan.count({
      where: {
        saccoId: context.saccoId,
        status: "PENDING",
      },
    }),
    prisma.auditLog.count({
      where: {
        saccoId: context.saccoId,
        entity: "MemberRequest",
        afterJson: {
          contains: '"status":"PENDING"',
        },
      },
    }),
    prisma.loan.count({
      where: {
        saccoId: context.saccoId,
        status: "DEFAULTED",
      },
    }),
    SettingsService.get(context.saccoId),
    BillingService.getAccessState(context.saccoId),
  ]);

  const isApprovalRole = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "LOAN_OFFICER"].includes(
    role,
  );

  const roleInGroup = (userRole: string, group: "CREDIT" | "FINANCE") => {
    if (group === "CREDIT") {
      return ["LOAN_OFFICER", "SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(userRole);
    }
    return ["TREASURER", "SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON"].includes(userRole);
  };

  let pendingLoanActionable = pendingLoanRequests;
  if (isApprovalRole && pendingLoanRequests > 0) {
    const pendingLoans = await prisma.loan.findMany({
      where: {
        saccoId: context.saccoId,
        status: "PENDING",
      },
      select: { id: true },
    });

    const approvalMatrixStates = await prisma.auditLog.findMany({
      where: {
        saccoId: context.saccoId,
        entity: "LoanApprovalMatrixState",
        entityId: { in: pendingLoans.map((loan) => loan.id) },
      },
      select: { entityId: true, afterJson: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const matrixByLoanId = new Map<
      string,
      {
        requiredApproverCount: number;
        requiredRoleGroups: Array<"CREDIT" | "FINANCE">;
        approvals: Array<{ actorId?: string; actorRole?: string }>;
        completed: boolean;
      }
    >();

    for (const entry of approvalMatrixStates) {
      if (matrixByLoanId.has(entry.entityId) || !entry.afterJson) {
        continue;
      }
      try {
        const parsed = JSON.parse(entry.afterJson) as {
          requiredApproverCount?: number;
          requiredRoleGroups?: unknown[];
          approvals?: unknown[];
          completed?: boolean;
        };
        matrixByLoanId.set(entry.entityId, {
          requiredApproverCount: Number(parsed.requiredApproverCount ?? 1),
          requiredRoleGroups: Array.isArray(parsed.requiredRoleGroups)
            ? parsed.requiredRoleGroups.filter((g): g is "CREDIT" | "FINANCE" => g === "CREDIT" || g === "FINANCE")
            : ["CREDIT"],
          approvals: Array.isArray(parsed.approvals)
            ? parsed.approvals.filter((step): step is { actorId?: string; actorRole?: string } => typeof step === "object" && step !== null)
            : [],
          completed: Boolean(parsed.completed),
        });
      } catch {
        continue;
      }
    }

    pendingLoanActionable = pendingLoans.filter((loan) => {
      const matrix = matrixByLoanId.get(loan.id);
      if (!matrix) {
        return roleInGroup(role, "CREDIT") || roleInGroup(role, "FINANCE");
      }
      if (matrix.completed) {
        return false;
      }
      const alreadyApproved = matrix.approvals.some((step) => step.actorId === context.id);
      if (alreadyApproved) {
        return false;
      }
      const roleEligible = matrix.requiredRoleGroups.some((group) => roleInGroup(role, group));
      if (!roleEligible) {
        return false;
      }
      const currentCount = matrix.approvals.length;
      const groupCoverage = matrix.requiredRoleGroups.every((group) =>
        matrix.approvals.some((step) => roleInGroup(step.actorRole ?? "", group)),
      );
      return currentCount < matrix.requiredApproverCount || !groupCoverage;
    }).length;
  }

  const appProfile = await prisma.appUser.findUnique({
    where: { id: context.id },
    select: { fullName: true, email: true },
  });

  const fallbackNameFromEmail = (email: string | null | undefined) => {
    if (!email) {
      return "SACCO User";
    }
    const localPart = email.split("@")[0] ?? "SACCO User";
    return localPart
      .replace(/[._-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(" ");
  };

  const displayEmail = appProfile?.email ?? session.user.email ?? "user@sacco.com";
  const displayName =
    appProfile?.fullName?.trim() ||
    (session.user.name && !session.user.name.includes("@")
      ? session.user.name
      : fallbackNameFromEmail(displayEmail));

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar
        role={role}
        languageLevel={settings.experience.languageLevel}
        tenant={
          context.tenantOptions && context.tenantOptions.length > 0
            ? {
                activeSaccoId: context.saccoId,
                options: context.tenantOptions,
              }
            : undefined
        }
        badges={{
          pendingLoanRequests: pendingLoanActionable,
          pendingMemberRequests,
          defaultedCollectionCases,
        }}
        user={{
          name: displayName,
          email: displayEmail,
        }}
      />
      <SidebarInset>
        {context.assumedTenant ? (
          <AssumeTenantBanner
            saccoCode={context.assumedTenant.saccoCode}
            reason={context.assumedTenant.reason}
          />
        ) : null}
        {billingAccess.canAccess ? (
          children
        ) : (
          <BillingPaywall
            role={role}
            trialDaysLeft={billingAccess.trialDaysLeft}
            status={billingAccess.subscription.status}
            plan={billingAccess.subscription.plan}
            billingCycle={billingAccess.subscription.billingCycle}
            currency={billingAccess.subscription.currency}
            usage={billingAccess.usage}
            planOptions={billingAccess.planOptions.map((plan) => ({
              ...plan,
              monthlyAmount: plan.monthlyAmount.toString(),
              annualAmount: plan.annualAmount.toString(),
            }))}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
