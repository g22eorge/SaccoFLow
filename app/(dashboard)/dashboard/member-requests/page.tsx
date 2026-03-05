import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { MemberRequestsQueue } from "@/src/ui/components/member-requests-queue";

export default async function MemberRequestsPage() {
  const { saccoId, role } = await requireSaccoContext();

  if (
    ![
      "SACCO_ADMIN",
      "SUPER_ADMIN",
      "CHAIRPERSON",
      "TREASURER",
      "AUDITOR",
      "BOARD_MEMBER",
    ].includes(role)
  ) {
    redirect("/dashboard");
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      saccoId,
      entity: "MemberRequest",
    },
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  const memberIds = [...new Set(logs.map((log) => log.entityId.split(":")[0]).filter(Boolean))];
  const members = await prisma.member.findMany({
    where: {
      saccoId,
      id: { in: memberIds },
    },
    select: {
      id: true,
      memberNumber: true,
      fullName: true,
    },
  });

  const memberMap = new Map(
    members.map((member) => [member.id, `${member.memberNumber} - ${member.fullName}`]),
  );

  const requests = logs.map((log) => {
    const after = log.afterJson ? JSON.parse(log.afterJson) : {};
    const memberId = log.entityId.split(":")[0];
    return {
      id: log.id,
      memberLabel: memberMap.get(memberId) ?? memberId,
      type: String(after.type ?? "REQUEST"),
      amount: String(after.amount ?? "0"),
      status: String(after.status ?? "PENDING"),
      note: typeof after.note === "string" ? after.note : null,
      reviewNote: typeof after.reviewNote === "string" ? after.reviewNote : null,
      createdAt: log.createdAt.toISOString(),
      reviewedAt:
        typeof after.reviewedAt === "string" ? after.reviewedAt : null,
    };
  });

  const canReview = ["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"].includes(role);

  const pendingCount = requests.filter((request) => request.status === "PENDING").length;
  const approvedCount = requests.filter((request) => request.status === "APPROVED").length;
  const rejectedCount = requests.filter((request) => request.status === "REJECTED").length;

  return (
    <>
      <SiteHeader title="Member Requests" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
              <section className="space-y-6">
                <div className="rounded-lg border bg-card p-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#cc5500]">
                    Self-Service Governance
                  </p>
                  <h1 className="mt-2 text-2xl font-bold">Member Requests</h1>
                  <p className="mt-2 text-muted-foreground">
                    Central queue for member withdrawal and share-redemption requests.
                  </p>
                </div>

                <section className="rounded-lg border bg-card p-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                      <p className="mt-1 text-2xl font-bold">{pendingCount}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
                      <p className="mt-1 text-2xl font-bold">{approvedCount}</p>
                    </article>
                    <article className="rounded-md border bg-background px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
                      <p className="mt-1 text-2xl font-bold">{rejectedCount}</p>
                    </article>
                  </div>
                </section>

                <MemberRequestsQueue requests={requests} canReview={canReview} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
