import { prisma } from "@/src/server/db/prisma";
import {
  createMemberSchema,
  updateMemberSchema,
} from "@/src/server/validators/members";
import { AuditService } from "@/src/server/services/audit.service";

export const MembersService = {
  async generateNextMemberNumber(saccoId: string) {
    const members = await prisma.member.findMany({
      where: { saccoId },
      select: { memberNumber: true },
    });

    const maxSequence = members.reduce((max, member) => {
      const match = /^M-(\d+)$/i.exec(member.memberNumber.trim());
      if (!match) {
        return max;
      }
      const parsed = Number(match[1]);
      if (Number.isNaN(parsed)) {
        return max;
      }
      return Math.max(max, parsed);
    }, 0);

    return `M-${String(maxSequence + 1).padStart(4, "0")}`;
  },

  async list(input: { saccoId: string; search?: string; page: number }) {
    const pageSize = 20;
    const skip = Math.max(input.page - 1, 0) * pageSize;

    return prisma.member.findMany({
      where: {
        saccoId: input.saccoId,
        ...(input.search
          ? {
              OR: [
                { fullName: { contains: input.search } },
                { memberNumber: { contains: input.search } },
              ],
            }
          : {}),
      },
      take: pageSize,
      skip,
      orderBy: { createdAt: "desc" },
    });
  },

  async getById(id: string, saccoId: string) {
    return prisma.member.findFirst({ where: { id, saccoId } });
  },

  async getByIds(saccoId: string, ids: string[]) {
    return prisma.member.findMany({
      where: {
        saccoId,
        id: { in: ids },
      },
      select: {
        id: true,
        fullName: true,
        memberNumber: true,
      },
    });
  },

  async create(payload: unknown, actorId?: string) {
    const data = createMemberSchema.parse(payload);
    const member = await prisma.member.create({ data });
    await AuditService.record({
      saccoId: member.saccoId,
      actorId,
      action: "CREATE",
      entity: "Member",
      entityId: member.id,
      after: member,
    });
    return member;
  },

  async update(
    id: string,
    saccoId: string,
    payload: unknown,
    actorId?: string,
  ) {
    const data = updateMemberSchema.parse(payload);
    const existing = await prisma.member.findFirstOrThrow({
      where: { id, saccoId },
    });
    const updated = await prisma.member.update({
      where: { id },
      data,
    });
    await AuditService.record({
      saccoId,
      actorId,
      action: "UPDATE",
      entity: "Member",
      entityId: id,
      before: existing,
      after: updated,
    });
    return updated;
  },

  async remove(id: string, saccoId: string, actorId?: string) {
    const existing = await prisma.member.findFirstOrThrow({
      where: { id, saccoId },
    });
    const deleted = await prisma.member.delete({ where: { id } });
    await AuditService.record({
      saccoId,
      actorId,
      action: "DELETE",
      entity: "Member",
      entityId: id,
      before: existing,
    });
    return deleted;
  },
};
