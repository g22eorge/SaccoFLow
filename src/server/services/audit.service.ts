import { prisma } from "@/src/server/db/prisma";

type RecordAuditInput = {
  saccoId: string;
  actorId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

type ListAuditInput = {
  saccoId: string;
  page: number;
  entity?: string;
  actorId?: string;
};

const toJson = (value: unknown) => {
  if (value === undefined) {
    return null;
  }
  return JSON.stringify(value);
};

export const AuditService = {
  async record(input: RecordAuditInput) {
    return prisma.auditLog.create({
      data: {
        saccoId: input.saccoId,
        actorId: input.actorId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        beforeJson: toJson(input.before),
        afterJson: toJson(input.after),
      },
    });
  },

  async list(input: ListAuditInput) {
    const pageSize = 30;
    const skip = Math.max(input.page - 1, 0) * pageSize;

    return prisma.auditLog.findMany({
      where: {
        saccoId: input.saccoId,
        ...(input.entity ? { entity: input.entity } : {}),
        ...(input.actorId ? { actorId: input.actorId } : {}),
      },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip,
    });
  },
};
