import { NextRequest } from "next/server";
import { z } from "zod";
import { created, ok, withApiHandler } from "@/src/server/api/http";
import { requireRoles, requireSaccoContext } from "@/src/server/auth/rbac";

const savingsProductSchema = z.object({
  name: z.string().min(2),
  contributionType: z.enum(["COMPULSORY", "VOLUNTARY"]),
  minimumAmount: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withApiHandler(async () => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER", "AUDITOR", "LOAN_OFFICER"]);
  const { saccoId } = await requireSaccoContext();
  const { prisma } = await import("@/src/server/db/prisma");
  const products = await prisma.savingsProduct.findMany({
    where: { saccoId },
    orderBy: [{ contributionType: "asc" }, { name: "asc" }],
  });
  return ok(products);
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await requireRoles(["SACCO_ADMIN", "SUPER_ADMIN", "CHAIRPERSON", "TREASURER"]);
  const { saccoId } = await requireSaccoContext();
  const parsed = savingsProductSchema.parse(await request.json());
  const { prisma } = await import("@/src/server/db/prisma");

  const createdProduct = await prisma.savingsProduct.create({
    data: {
      saccoId,
      name: parsed.name,
      contributionType: parsed.contributionType,
      minimumAmount: parsed.minimumAmount,
      isActive: parsed.isActive ?? true,
    },
  });
  return created(createdProduct);
});
