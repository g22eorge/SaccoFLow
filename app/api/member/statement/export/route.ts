import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/src/server/api/http";
import { getSession, requireSaccoContext } from "@/src/server/auth/rbac";
import { prisma } from "@/src/server/db/prisma";
import { ReportsService } from "@/src/server/services/reports.service";
import { toSimplePdf } from "@/src/server/export/tabular";

export const GET = withApiHandler(async (request: NextRequest) => {
  const { saccoId, role } = await requireSaccoContext();
  if (role !== "MEMBER") {
    throw new Error("Only members can export personal statements");
  }

  const session = await getSession();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    throw new Error("Missing authenticated member email");
  }

  const member = await prisma.member.findFirst({
    where: { saccoId, email },
    select: { id: true, memberNumber: true },
  });
  if (!member) {
    throw new Error("Member profile not linked");
  }

  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const format = request.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";

  if (format === "pdf") {
    const statement = await ReportsService.memberStatement({
      saccoId,
      memberId: member.id,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });

    const rows = statement.events.map((event) => [
      event.date.toISOString(),
      event.type,
      event.amount,
      event.note ?? "",
    ]);

    const pdf = toSimplePdf(
      `Member Statement ${statement.member.memberNumber}`,
      ["date", "type", "amount", "note"],
      rows,
    );

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="member-statement-${member.memberNumber}.pdf"`,
      },
    });
  }

  const csv = await ReportsService.memberStatementCsv({
    saccoId,
    memberId: member.id,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="member-statement-${member.memberNumber}.csv"`,
    },
  });
});
