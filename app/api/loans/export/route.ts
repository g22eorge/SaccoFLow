import { NextRequest, NextResponse } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { LoansService } from "@/src/server/services/loans.service";
import { MembersService } from "@/src/server/services/members.service";
import { AuditService } from "@/src/server/services/audit.service";
import { toCsv, toSimplePdf } from "@/src/server/export/tabular";
import { formatDateTimeUtc } from "@/src/lib/datetime";
import { formatMemberLabel } from "@/src/lib/member-label";
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
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const sortBy = request.nextUrl.searchParams.get("sort");
  const formatParam = request.nextUrl.searchParams.get("format");
  const format =
    formatParam === "pdf" ? "pdf" : formatParam === "excel" ? "excel" : "csv";

  const paged = await LoansService.listPaged({
    saccoId,
    status,
    page,
    query,
    sortBy:
      sortBy === "name" || sortBy === "outstanding" || sortBy === "dueSoon"
        ? sortBy
        : "dueSoon",
  });
  const loans = paged.rows;
  const memberIds = [...new Set(loans.map((loan) => loan.memberId))];
  const members = await MembersService.getByIds(saccoId, memberIds);
  const memberMap = new Map(
    members.map((member) => [member.id, formatMemberLabel(member.memberNumber, member.fullName)]),
  );

  const headers = [
    "member",
    "status",
    "principal",
    "outstandingPrincipal",
    "outstandingInterest",
    "outstandingPenalty",
    "termMonths",
    "appliedAt",
  ];
  const rows = loans.map((loan) => [
    memberMap.get(loan.memberId) ?? "Unknown member",
    loan.status,
    loan.principalAmount.toString(),
    loan.outstandingPrincipal.toString(),
    loan.outstandingInterest.toString(),
    loan.outstandingPenalty.toString(),
    String(loan.termMonths),
    formatDateTimeUtc(loan.appliedAt),
  ]);

  await AuditService.record({
    saccoId,
    actorId,
    action: "EXPORT",
    entity: "Loans",
    entityId: `page-${page}`,
    after: { format, count: rows.length, status: status ?? "ALL" },
  });

  if (format === "pdf") {
    const pdf = toSimplePdf(`Loans Export (Page ${page})`, headers, rows);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="loans-page-${page}.pdf"`,
      },
    });
  }

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type":
        format === "excel"
          ? "application/vnd.ms-excel; charset=utf-8"
          : "text/csv; charset=utf-8",
      "content-disposition":
        format === "excel"
          ? `attachment; filename="loans-page-${page}.xls"`
          : `attachment; filename="loans-page-${page}.csv"`,
    },
  });
});
