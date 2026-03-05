import { NextRequest, NextResponse } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { SavingsService } from "@/src/server/services/savings.service";
import { MembersService } from "@/src/server/services/members.service";
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

  const transactions = await SavingsService.list({ saccoId, page });
  const memberIds = [...new Set(transactions.map((tx) => tx.memberId))];
  const members = await MembersService.getByIds(saccoId, memberIds);
  const memberMap = new Map(members.map((member) => [member.id, `${member.memberNumber} - ${member.fullName}`]));

  const headers = ["member", "type", "amount", "note", "createdAt"];
  const rows = transactions.map((tx) => [
    memberMap.get(tx.memberId) ?? tx.memberId,
    tx.type,
    tx.amount.toString(),
    tx.note ?? "",
    formatDateTimeUtc(tx.createdAt),
  ]);

  await AuditService.record({
    saccoId,
    actorId,
    action: "EXPORT",
    entity: "Savings",
    entityId: `page-${page}`,
    after: { format, count: rows.length },
  });

  if (format === "pdf") {
    const pdf = toSimplePdf(`Savings Export (Page ${page})`, headers, rows);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="savings-page-${page}.pdf"`,
      },
    });
  }

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="savings-page-${page}.csv"`,
    },
  });
});
