import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";
import { ExternalCapitalService } from "@/src/server/services/external-capital.service";
import { toCsv, toSimplePdf } from "@/src/server/export/tabular";

export const GET = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR"]);
  const { saccoId } = await requireSaccoContext();
  const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";

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

  if (format === "pdf") {
    const pdf = toSimplePdf("External Capital Report", headers, tableRows);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="external-capital.pdf"',
      },
    });
  }

  const csv = toCsv(headers, tableRows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="external-capital.csv"',
    },
  });
});
