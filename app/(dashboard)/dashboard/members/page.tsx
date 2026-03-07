import { requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { CreateMemberForm } from "@/src/ui/forms/create-member-form";
import { MembersTable } from "@/src/ui/tables/members-table";
import { formatMoney } from "@/src/lib/money";
import { formatMemberLabel } from "@/src/lib/member-label";
import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

const signalTone = (status: "Strong" | "Watch" | "Critical") =>
  status === "Strong"
    ? "text-emerald-700 bg-emerald-50"
    : status === "Watch"
      ? "text-amber-700 bg-amber-50"
      : "text-red-700 bg-red-50";

export default async function MembersPage({
  searchParams,
}: {
  searchParams?: { page?: string };
}) {
  const { saccoId, role } = await requireSaccoContext();
  if (
    !["SACCO_ADMIN", "SUPER_ADMIN", "TREASURER", "AUDITOR", "LOAN_OFFICER"].includes(role)
  ) {
    redirect("/dashboard");
  }
  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const members = await MembersService.list({ saccoId, page });
  const hasNextPage = members.length === 20;
  const balances = await Promise.all(
    members.map(async (member) => ({
      memberId: member.id,
      balance: await SavingsService.getMemberBalance(saccoId, member.id),
    })),
  );

  const balanceMap = new Map(
    balances.map((entry) => [entry.memberId, entry.balance.toString()]),
  );

  const tableMembers = members.map((member) => ({
    id: member.id,
    memberNumber: member.memberNumber,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    status: member.status,
    savingsBalance: balanceMap.get(member.id) ?? "0",
  }));

  const totalSavings = balances.reduce(
    (sum, entry) => sum.plus(entry.balance),
    new Prisma.Decimal(0),
  );
  const totalMembers = members.length;
  const activeMembers = members.filter((member) => member.status === "ACTIVE").length;
  const membersWithSavings = balances.filter((entry) => entry.balance.gt(0)).length;
  const averageSavings =
    totalMembers > 0
      ? Number(totalSavings.toString()) / totalMembers
      : 0;
  const activeRate = totalMembers > 0 ? (activeMembers / totalMembers) * 100 : 0;
  const savingsParticipation =
    totalMembers > 0 ? (membersWithSavings / totalMembers) * 100 : 0;
  const membersWithContact = members.filter(
    (member) => Boolean(member.phone) || Boolean(member.email),
  ).length;
  const contactCoverage =
    totalMembers > 0 ? (membersWithContact / totalMembers) * 100 : 0;
  const inactiveMembers = totalMembers - activeMembers;

  const balancesByMember = members
    .map((member) => {
      const balance = Number(balanceMap.get(member.id) ?? "0");
      return {
        memberId: member.id,
        label: formatMemberLabel(member.memberNumber, member.fullName),
        balance,
      };
    })
    .sort((a, b) => b.balance - a.balance);

  const topSavers = balancesByMember.slice(0, 5);
  const topSaverConcentration =
    Number(totalSavings.toString()) > 0
      ? (topSavers.reduce((sum, row) => sum + row.balance, 0) /
          Number(totalSavings.toString())) *
        100
      : 0;

  const decisionSignals = [
    {
      name: "Active Membership",
      value: `${activeRate.toFixed(1)}%`,
      target: ">= 90%",
      status:
        activeRate >= 90
          ? ("Strong" as const)
          : activeRate >= 75
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Savings Participation",
      value: `${savingsParticipation.toFixed(1)}%`,
      target: ">= 70%",
      status:
        savingsParticipation >= 70
          ? ("Strong" as const)
          : savingsParticipation >= 55
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Contact Coverage",
      value: `${contactCoverage.toFixed(1)}%`,
      target: ">= 95%",
      status:
        contactCoverage >= 95
          ? ("Strong" as const)
          : contactCoverage >= 80
            ? ("Watch" as const)
            : ("Critical" as const),
    },
    {
      name: "Top-5 Savings Concentration",
      value: `${topSaverConcentration.toFixed(1)}%`,
      target: "<= 60%",
      status:
        topSaverConcentration <= 60
          ? ("Strong" as const)
          : topSaverConcentration <= 75
            ? ("Watch" as const)
            : ("Critical" as const),
    },
  ];

  const scenarioCards = [
    {
      label: "Base Case",
      projectedSavings: Number(totalSavings.toString()),
      impact: 0,
    },
    {
      label: "Participation +10pp",
      projectedSavings:
        Number(totalSavings.toString()) +
        Math.max(0, (totalMembers * 0.1 * averageSavings)),
      impact: Math.max(0, totalMembers * 0.1 * averageSavings),
    },
    {
      label: "Average Savings +5%",
      projectedSavings: Number(totalSavings.toString()) * 1.05,
      impact: Number(totalSavings.toString()) * 0.05,
    },
  ];

  const actionQueue = [
    savingsParticipation < 70
      ? {
          title: "Boost savings participation",
          detail: `${(70 - savingsParticipation).toFixed(1)}pp gap to participation target`,
          href: "/dashboard/savings",
        }
      : null,
    contactCoverage < 95
      ? {
          title: "Complete member contact records",
          detail: `${totalMembers - membersWithContact} members missing phone/email`,
          href: "/dashboard/members",
        }
      : null,
    inactiveMembers > 0
      ? {
          title: "Review inactive members",
          detail: `${inactiveMembers} inactive profiles need follow-up`,
          href: "/dashboard/members",
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string; href: string }>;

  return (
    <>
      <SiteHeader title="Members" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                        Directory
                      </p>
                      <h1 className="mt-2 text-2xl font-bold">Members</h1>
                      <p className="mt-2 text-muted-foreground">
                        Manage SACCO members and maintain their profiles.
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {new Date().toLocaleString()} | Page {page}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/api/members/export?format=csv&page=${page}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export CSV
                      </Link>
                      <Link
                        href={`/api/members/export?format=pdf&page=${page}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        Export PDF
                      </Link>
                    </div>
                  </div>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Members</p>
                      <p className="mt-1 text-2xl font-bold">{totalMembers}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Active: {activeMembers} ({activeRate.toFixed(1)}%)
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Savings</p>
                      <p className="mt-1 text-2xl font-bold">
                        {formatMoney(totalSavings.toString())}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Avg/member: {formatMoney(averageSavings)}
                      </p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Savings Participation</p>
                      <p className="mt-1 text-2xl font-bold">{savingsParticipation.toFixed(1)}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">Members with savings: {membersWithSavings}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact Coverage</p>
                      <p className="mt-1 text-2xl font-bold">{contactCoverage.toFixed(1)}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">Profiles with phone or email</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Inactive Members</p>
                      <p className="mt-1 text-2xl font-bold">{inactiveMembers}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Require retention or status review</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Top-5 Concentration</p>
                      <p className="mt-1 text-2xl font-bold">{topSaverConcentration.toFixed(1)}%</p>
                      <p className="mt-1 text-xs text-muted-foreground">Share of savings held by top 5 savers</p>
                    </article>
                  </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Executive Signals</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Target-vs-actual quality checks for membership health.
                    </p>
                    <div className="mt-4 space-y-3">
                      {decisionSignals.map((signal) => (
                        <article
                          key={signal.name}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{signal.name}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${signalTone(signal.status)}`}
                            >
                              {signal.status}
                            </span>
                          </div>
                          <p className="mt-1 text-lg font-semibold">{signal.value}</p>
                          <p className="text-xs text-muted-foreground">Target: {signal.target}</p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Top Savers</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Largest contributors to the SACCO savings pool.
                    </p>
                    <div className="mt-4 space-y-2">
                      {topSavers.map((holder) => {
                        const share =
                          Number(totalSavings.toString()) > 0
                            ? (holder.balance / Number(totalSavings.toString())) * 100
                            : 0;
                        return (
                          <article
                            key={holder.memberId}
                            className="rounded-md border bg-background px-4 py-3"
                          >
                            <p className="text-sm font-medium">{holder.label}</p>
                            <div className="mt-1 flex items-center justify-between text-sm">
                              <span className="font-semibold">{formatMoney(holder.balance)}</span>
                              <span className="text-muted-foreground">{share.toFixed(1)}%</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Scenario Outlook</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Quick growth scenarios for member-led savings planning.
                    </p>
                    <div className="mt-4 space-y-3">
                      {scenarioCards.map((scenario) => (
                        <article
                          key={scenario.label}
                          className="rounded-md border bg-background px-4 py-3"
                        >
                          <p className="text-sm font-medium">{scenario.label}</p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatMoney(scenario.projectedSavings)}
                          </p>
                          <p className="mt-1 text-xs text-emerald-700">
                            Impact: +{formatMoney(scenario.impact)}
                          </p>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border bg-card p-6">
                    <h2 className="text-lg font-semibold">Priority Actions</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recommended interventions from member performance signals.
                    </p>
                    <div className="mt-4 space-y-3">
                      {actionQueue.length > 0 ? (
                        actionQueue.map((action) => (
                          <article
                            key={action.title}
                            className="rounded-md border bg-background px-4 py-3"
                          >
                            <p className="text-sm font-semibold">{action.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{action.detail}</p>
                            <Link
                              href={action.href}
                              className="mt-2 inline-block text-xs text-[#cc5500]"
                            >
                              Open recommendation
                            </Link>
                          </article>
                        ))
                      ) : (
                        <article className="rounded-md border bg-background px-4 py-3">
                          <p className="text-sm font-semibold text-emerald-700">
                            No immediate intervention flags.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Membership health is currently within policy targets.
                          </p>
                        </article>
                      )}
                    </div>
                  </section>
                </div>

                <CreateMemberForm />
                <MembersTable members={tableMembers} />

                <section className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={page > 1 ? `/dashboard/members?page=${page - 1}` : "#"}
                      className={`text-sm ${page > 1 ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Previous
                    </Link>
                    <span className="text-sm text-muted-foreground">Page {page}</span>
                    <Link
                      href={hasNextPage ? `/dashboard/members?page=${page + 1}` : "#"}
                      className={`text-sm ${hasNextPage ? "text-[#cc5500]" : "pointer-events-none text-muted-foreground"}`}
                    >
                      Next
                    </Link>
                  </div>
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
