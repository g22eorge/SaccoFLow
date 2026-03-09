import { NextRequest, NextResponse } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { SavingsService } from "@/src/server/services/savings.service";
import { MembersService } from "@/src/server/services/members.service";
import { AuditService } from "@/src/server/services/audit.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { buildExportMetadata } from "@/src/server/export/branding";
import { toCsv, toSimplePdf, toXlsx } from "@/src/server/export/tabular";
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
  await SettingsService.assertCapitalEnabled(saccoId, "SAVINGS");

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const formatParam = request.nextUrl.searchParams.get("format");
  const format =
    formatParam === "pdf" ? "pdf" : formatParam === "excel" ? "excel" : "csv";

  const transactions = await SavingsService.list({ saccoId, page });
  const settings = await SettingsService.get(saccoId);
  const memberIds = [...new Set(transactions.map((tx) => tx.memberId))];
  const members = await MembersService.getByIds(saccoId, memberIds);
  const memberMap = new Map(
    members.map((member) => [member.id, formatMemberLabel(member.memberNumber, member.fullName)]),
  );

  const headers = ["member", "type", "amount", "note", "createdAt"];
  const rows = transactions.map((tx) => [
    memberMap.get(tx.memberId) ?? "Unknown member",
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
    const metadata = buildExportMetadata({
      settings,
      generatedAt: formatDateTimeUtc(new Date()),
      preparedBy: actorId,
    });
    const pdf = toSimplePdf(`Savings Export (Page ${page})`, headers, rows, metadata);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="savings-page-${page}.pdf"`,
      },
    });
  }

  const metadata = buildExportMetadata({
    settings,
    generatedAt: formatDateTimeUtc(new Date()),
    preparedBy: actorId,
  });
  if (format === "excel") {
    const xlsx = toXlsx(`Savings ${page}`, headers, rows, metadata);
    return new NextResponse(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="savings-page-${page}.xlsx"`,
      },
    });
  }

  const csv = toCsv(headers, rows, metadata);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="savings-page-${page}.csv"`,
    },
  });
});
