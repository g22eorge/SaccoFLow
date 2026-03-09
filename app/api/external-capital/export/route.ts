import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";
import { SettingsService } from "@/src/server/services/settings.service";
import { buildExportMetadata } from "@/src/server/export/branding";
import { toCsv, toSimplePdf, toXlsx } from "@/src/server/export/tabular";
import { formatDateTimeUtc } from "@/src/lib/datetime";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"]);
  const { saccoId, id: actorId } = await requireSaccoContext();
  const formatParam = request.nextUrl.searchParams.get("format");
  const format =
    formatParam === "pdf" ? "pdf" : formatParam === "excel" ? "excel" : "csv";
  const settings = await SettingsService.get(saccoId);

  const rows = await ExternalCapitalService.list({ saccoId, page: 1 });
  const headers = [
    "receivedAt",
    "type",
    "status",
    "source",
    "currency",
    "amount",
    "fxRate",
    "baseAmount",
    "allocationBucket",
    "amlFlag",
  ];
  const tableRows = rows.map((row: (typeof rows)[number]) => [
    row.receivedAt.toISOString(),
    row.type,
    row.status,
    row.source,
    row.currency,
    row.amount.toString(),
    row.fxRate.toString(),
    row.baseAmount.toString(),
    row.allocationBucket ?? "",
    row.amlFlag ? "YES" : "NO",
  ]);
  const metadata = buildExportMetadata({
    settings,
    generatedAt: formatDateTimeUtc(new Date()),
    preparedBy: actorId,
  });

  if (format === "pdf") {
    const pdf = toSimplePdf("External Capital Report", headers, tableRows, metadata);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="external-capital.pdf"',
      },
    });
  }

  if (format === "excel") {
    const xlsx = toXlsx("External Capital", headers, tableRows, metadata);
    return new NextResponse(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="external-capital.xlsx"',
      },
    });
  }

  const csv = toCsv(headers, tableRows, metadata);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="external-capital.csv"',
    },
  });
});
