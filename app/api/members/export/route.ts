import { NextRequest, NextResponse } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { MembersService } from "@/src/server/services/members.service";
import { SavingsService } from "@/src/server/services/savings.service";
import { AuditService } from "@/src/server/services/audit.service";
import { toCsv, toSimplePdf } from "@/src/server/export/tabular";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { withApiHandler } from "@/src/server/api/http";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles([
    "SACCO_ADMIN",
    "SUPER_ADMIN",
    "CHAIRPERSON",
    "BOARD_MEMBER",
    "TREASURER",
    "AUDITOR",
    "LOAN_OFFICER",
  ]);
  const { saccoId, id: actorId } = await requireSaccoContext();

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";

  const members = await MembersService.list({ saccoId, page });
  const balances = await Promise.all(
    members.map(async (member) => ({
      memberId: member.id,
      balance: await SavingsService.getMemberBalance(saccoId, member.id),
    })),
  );
  const balanceMap = new Map(balances.map((entry) => [entry.memberId, entry.balance.toString()]));

  const headers = ["memberNumber", "fullName", "phone", "email", "status", "joinedAt", "savingsBalance"];
  const rows = members.map((member) => [
    member.memberNumber,
    member.fullName,
    member.phone ?? "",
    member.email ?? "",
    member.status,
    formatDateTimeUtc(member.joinedAt),
    balanceMap.get(member.id) ?? "0.00",
  ]);

  await AuditService.record({
    saccoId,
    actorId,
    action: "EXPORT",
    entity: "Members",
    entityId: `page-${page}`,
    after: { format, count: rows.length },
  });

  if (format === "pdf") {
    const pdf = toSimplePdf(`Members Export (Page ${page})`, headers, rows);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="members-page-${page}.pdf"`,
      },
    });
  }

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="members-page-${page}.csv"`,
    },
  });
});
