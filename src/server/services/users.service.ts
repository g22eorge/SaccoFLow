import { Prisma } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserAccessSchema,
} from "@/src/server/validators/users";
import { auth } from "@/src/server/auth/auth";
import { AuditService } from "@/src/server/services/audit.service";
import { MembersService } from "@/src/server/services/members.service";
import { ASSIGNABLE_ROLES_BY_ACTOR } from "@/src/lib/roles";

type ManageableRole =
  | "SUPER_ADMIN"
  | "SACCO_ADMIN"
  | "CHAIRPERSON"
  | "BOARD_MEMBER"
  | "TREASURER"
  | "LOAN_OFFICER"
  | "AUDITOR"
  | "MEMBER";

const assignableRolesByActor = ASSIGNABLE_ROLES_BY_ACTOR as Record<
  ManageableRole,
  readonly ManageableRole[]
>;

export const UsersService = {
  async list(input: { saccoId: string; page: number }) {
    const pageSize = 20;
    const skip = Math.max(input.page - 1, 0) * pageSize;

    return prisma.appUser.findMany({
      where: { saccoId: input.saccoId },
      take: pageSize,
      skip,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  },

  async create(payload: unknown, actorId?: string) {
    const parsed = createUserSchema.parse(payload);
    const email = parsed.email.toLowerCase();
    const context = await auth.$context;
    const authUser = await context.internalAdapter.findUserByEmail(email, {
      includeAccounts: true,
    });
    const generatedPassword =
      parsed.password ?? `Sacco${crypto.randomUUID().slice(0, 10)}!`;

    let authUserId = authUser?.user?.id;
    let createdCredential = false;

    if (!authUserId) {
      const createdUser = await context.internalAdapter.createUser({
        email,
        name: parsed.fullName ?? email,
        emailVerified: true,
      });
      authUserId = createdUser.id;
    }

    if (!authUserId) {
      throw new Error("Failed to create auth user");
    }

    const accounts =
      authUser?.accounts ??
      (await context.internalAdapter.findAccounts(authUserId));
    const credentialAccount = accounts.find(
      (account) => account.providerId === "credential",
    );

    if (!credentialAccount) {
      const passwordHash = await context.password.hash(generatedPassword);
      await context.internalAdapter.linkAccount({
        userId: authUserId,
        providerId: "credential",
        accountId: authUserId,
        password: passwordHash,
      });
      createdCredential = true;
    }

    const appUser = await prisma.appUser.upsert({
      where: { authUserId },
      update: {
        email,
        fullName: parsed.fullName,
        role: parsed.role,
        saccoId: parsed.saccoId,
        isActive: true,
      },
      create: {
        saccoId: parsed.saccoId,
        email,
        fullName: parsed.fullName,
        role: parsed.role,
        authUserId,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    const result = {
      ...appUser,
      generatedPassword: createdCredential ? generatedPassword : undefined,
    };

    await AuditService.record({
      saccoId: parsed.saccoId,
      actorId,
      action: "UPSERT",
      entity: "AppUser",
      entityId: appUser.id,
      after: {
        id: appUser.id,
        email: appUser.email,
        role: appUser.role,
        isActive: appUser.isActive,
      },
    });

    if (appUser.role === "MEMBER") {
      await UsersService.ensureMemberProfile({
        saccoId: parsed.saccoId,
        email,
        fullName: appUser.fullName ?? parsed.fullName ?? email,
        actorId,
      });
    }

    return result;
  },

  async resetPassword(
    payload: {
      saccoId: string;
      targetUserId: string;
      actorRole: ManageableRole;
      actorId?: string;
      password?: string;
    },
  ) {
    const parsed = resetUserPasswordSchema.parse({ password: payload.password });
    const target = await prisma.appUser.findFirst({
      where: {
        id: payload.targetUserId,
        saccoId: payload.saccoId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        authUserId: true,
      },
    });

    if (!target) {
      throw new Error("User not found");
    }

    const allowedRoles = (assignableRolesByActor[payload.actorRole] ?? []) as readonly string[];
    if (!allowedRoles.includes(target.role)) {
      throw new Error("You are not allowed to reset password for this role");
    }

    const passwordToSet =
      parsed.password ?? `Sacco${crypto.randomUUID().slice(0, 10)}!`;

    const context = await auth.$context;
    const accounts = await context.internalAdapter.findAccounts(target.authUserId);
    const credentialAccount = accounts.find(
      (account) => account.providerId === "credential",
    );
    const passwordHash = await context.password.hash(passwordToSet);

    if (credentialAccount) {
      await prisma.account.update({
        where: { id: credentialAccount.id },
        data: { password: passwordHash },
      });
    } else {
      await context.internalAdapter.linkAccount({
        userId: target.authUserId,
        providerId: "credential",
        accountId: target.authUserId,
        password: passwordHash,
      });
    }

    await prisma.session.deleteMany({
      where: { userId: target.authUserId },
    });

    await AuditService.record({
      saccoId: payload.saccoId,
      actorId: payload.actorId,
      action: "RESET_PASSWORD",
      entity: "AppUser",
      entityId: target.id,
      after: {
        id: target.id,
        email: target.email,
        role: target.role,
      },
    });

    return {
      id: target.id,
      email: target.email,
      role: target.role,
      temporaryPassword: passwordToSet,
    };
  },

  async updateAccess(payload: {
    saccoId: string;
    targetUserId: string;
    actorRole: ManageableRole;
    actorId?: string;
    role?: ManageableRole;
    isActive?: boolean;
  }) {
    const parsed = updateUserAccessSchema.parse({
      role: payload.role,
      isActive: payload.isActive,
    });

    const target = await prisma.appUser.findFirst({
      where: {
        id: payload.targetUserId,
        saccoId: payload.saccoId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!target) {
      throw new Error("User not found");
    }

    const manageableRoles = (assignableRolesByActor[payload.actorRole] ?? []) as readonly string[];
    if (!manageableRoles.includes(target.role)) {
      throw new Error("You are not allowed to manage this user");
    }

    if (parsed.role && !manageableRoles.includes(parsed.role)) {
      throw new Error("You are not allowed to assign this role");
    }

    const updated = await prisma.appUser.update({
      where: { id: payload.targetUserId },
      data: {
        ...(parsed.role ? { role: parsed.role } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await AuditService.record({
      saccoId: payload.saccoId,
      actorId: payload.actorId,
      action: "UPDATE_ACCESS",
      entity: "AppUser",
      entityId: updated.id,
      before: {
        role: target.role,
        isActive: target.isActive,
      },
      after: {
        role: updated.role,
        isActive: updated.isActive,
      },
    });

    return updated;
  },

  async revokeSessions(payload: {
    saccoId: string;
    targetUserId: string;
    actorRole: ManageableRole;
    actorId?: string;
  }) {
    const target = await prisma.appUser.findFirst({
      where: {
        id: payload.targetUserId,
        saccoId: payload.saccoId,
      },
      select: {
        id: true,
        email: true,
        role: true,
        authUserId: true,
      },
    });

    if (!target) {
      throw new Error("User not found");
    }

    const manageableRoles = (assignableRolesByActor[payload.actorRole] ?? []) as readonly string[];
    if (!manageableRoles.includes(target.role)) {
      throw new Error("You are not allowed to manage this user");
    }

    const result = await prisma.session.deleteMany({
      where: { userId: target.authUserId },
    });

    await AuditService.record({
      saccoId: payload.saccoId,
      actorId: payload.actorId,
      action: "REVOKE_SESSIONS",
      entity: "AppUser",
      entityId: target.id,
      after: {
        revokedSessions: result.count,
      },
    });

    return {
      id: target.id,
      email: target.email,
      revokedSessions: result.count,
    };
  },

  async ensureMemberProfile(input: {
    saccoId: string;
    email: string;
    fullName: string;
    actorId?: string;
  }) {
    const existingMember = await prisma.member.findFirst({
      where: {
        saccoId: input.saccoId,
        email: input.email,
      },
      select: { id: true },
    });
    if (existingMember) {
      return { created: false };
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const memberNumber = await MembersService.generateNextMemberNumber(
        input.saccoId,
      );
      try {
        await MembersService.create(
          {
            saccoId: input.saccoId,
            memberNumber,
            fullName: input.fullName,
            email: input.email,
          },
          input.actorId,
        );
        return { created: true, memberNumber };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Failed to generate a unique member number for user");
  },

  async syncExistingMemberUsers(
    input: { saccoId?: string; actorId?: string } = {},
  ) {
    const memberUsers = await prisma.appUser.findMany({
      where: {
        role: "MEMBER",
        isActive: true,
        ...(input.saccoId ? { saccoId: input.saccoId } : {}),
      },
      select: {
        id: true,
        saccoId: true,
        email: true,
        fullName: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const processed = new Set<string>();
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const user of memberUsers) {
      const key = `${user.saccoId}:${user.email.toLowerCase()}`;
      if (processed.has(key)) {
        skipped += 1;
        continue;
      }
      processed.add(key);

      try {
        const result = await UsersService.ensureMemberProfile({
          saccoId: user.saccoId,
          email: user.email,
          fullName: user.fullName ?? user.email,
          actorId: input.actorId,
        });

        if (result.created) {
          created += 1;
        } else {
          skipped += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      scanned: memberUsers.length,
      created,
      skipped,
      failed,
    };
  },
};
