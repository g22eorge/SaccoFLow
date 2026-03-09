import { NextRequest, NextResponse } from "next/server";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { SharesService } from "@/src/server/services/shares.service";
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

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1);
  const formatParam = request.nextUrl.searchParams.get("format");
  const format =
    formatParam === "pdf" ? "pdf" : formatParam === "excel" ? "excel" : "csv";
  const settings = await SettingsService.get(saccoId);

  const transactions = await SharesService.list({ saccoId, page });

  const headers = ["member", "eventType", "amount", "reference", "createdAt"];
  const rows = transactions.map((entry) => [
    entry.member
      ? formatMemberLabel(entry.member.memberNumber, entry.member.fullName)
      : entry.memberId ?? "Unknown",
    entry.eventType,
    entry.amount.toString(),
    entry.reference ?? "",
    formatDateTimeUtc(entry.createdAt),
  ]);

  await AuditService.record({
    saccoId,
    actorId,
    action: "EXPORT",
    entity: "Shares",
    entityId: `page-${page}`,
    after: { format, count: rows.length },
  });

  if (format === "pdf") {
    const metadata = buildExportMetadata({
      settings,
      generatedAt: formatDateTimeUtc(new Date()),
      preparedBy: actorId,
    });
    const pdf = toSimplePdf(`Shares Export (Page ${page})`, headers, rows, metadata);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="shares-page-${page}.pdf"`,
      },
    });
  }

  const metadata = buildExportMetadata({
    settings,
    generatedAt: formatDateTimeUtc(new Date()),
    preparedBy: actorId,
  });
  if (format === "excel") {
    const xlsx = toXlsx(`Shares ${page}`, headers, rows, metadata);
    return new NextResponse(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="shares-page-${page}.xlsx"`,
      },
    });
  }

  const csv = toCsv(headers, rows, metadata);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="shares-page-${page}.csv"`,
    },
  });
});
