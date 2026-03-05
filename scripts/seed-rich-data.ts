import {
  LoanStatus,
  Prisma,
  PrismaClient,
  Role,
  SavingsTransactionType,
} from "@prisma/client";

const prisma = new PrismaClient();

let seed = 20260305;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const randomInt = (min: number, max: number) =>
  Math.floor(random() * (max - min + 1)) + min;

const pickWeighted = <T>(items: Array<{ value: T; weight: number }>) => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) {
      return item.value;
    }
  }
  return items[items.length - 1].value;
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const firstNames = [
  "Amina",
  "Brian",
  "Caroline",
  "David",
  "Esther",
  "Felix",
  "Grace",
  "Hassan",
  "Irene",
  "John",
  "Kevin",
  "Lydia",
  "Moses",
  "Naomi",
  "Owen",
  "Patricia",
  "Quincy",
  "Ruth",
  "Samuel",
  "Tracy",
  "Umar",
  "Violet",
  "Wycliffe",
  "Yvonne",
  "Zaina",
];

const lastNames = [
  "Achieng",
  "Barasa",
  "Chemutai",
  "Ddamulira",
  "Ekirapa",
  "Fwamba",
  "Gatimu",
  "Hassan",
  "Isabirye",
  "Juma",
  "Kato",
  "Lutaaya",
  "Mugisha",
  "Nabirye",
  "Omondi",
  "Pereza",
  "Qureshi",
  "Rwothomio",
  "Ssemanda",
  "Tumusiime",
  "Uwayezu",
  "Wandera",
  "Yiga",
  "Zziwa",
];

const parseMemberSequence = (memberNumber: string) => {
  const match = /^M-(\d+)$/i.exec(memberNumber.trim());
  if (!match) {
    return 0;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function main() {
  const targetCode = process.argv[2] ?? "SACCOFLOW-DEMO";
  const targetName =
    targetCode === "SACCOFLOW-DEMO" ? "SACCOFlow Demo" : `${targetCode} Seed`;

  const sacco = await prisma.sacco.upsert({
    where: { code: targetCode },
    update: {},
    create: {
      name: targetName,
      code: targetCode,
    },
  });

  if (targetCode === "SACCOFLOW-DEMO") {
    await prisma.appUser.upsert({
      where: { authUserId: "seed-admin-auth-id" },
      update: {
        saccoId: sacco.id,
        role: Role.SACCO_ADMIN,
        isActive: true,
      },
      create: {
        saccoId: sacco.id,
        authUserId: "seed-admin-auth-id",
        email: "admin@example.com",
        fullName: "Seed Admin",
        role: Role.SACCO_ADMIN,
      },
    });

    const roleSeeds = [
      {
        authUserId: "seed-chairperson-auth-id",
        email: "chairperson@example.com",
        role: Role.CHAIRPERSON,
      },
      {
        authUserId: "seed-board-member-auth-id",
        email: "boardmember@example.com",
        role: Role.BOARD_MEMBER,
      },
      {
        authUserId: "seed-treasurer-auth-id",
        email: "treasurer@example.com",
        role: Role.TREASURER,
      },
      {
        authUserId: "seed-loan-officer-auth-id",
        email: "loanofficer@example.com",
        role: Role.LOAN_OFFICER,
      },
      {
        authUserId: "seed-auditor-auth-id",
        email: "auditor@example.com",
        role: Role.AUDITOR,
      },
    ];

    for (const roleSeed of roleSeeds) {
      await prisma.appUser.upsert({
        where: { authUserId: roleSeed.authUserId },
        update: {
          saccoId: sacco.id,
          role: roleSeed.role,
          isActive: true,
        },
        create: {
          saccoId: sacco.id,
          authUserId: roleSeed.authUserId,
          email: roleSeed.email,
          fullName: roleSeed.email.split("@")[0],
          role: roleSeed.role,
        },
      });
    }
  }

  await prisma.loanRepayment.deleteMany({ where: { saccoId: sacco.id } });
  await prisma.loan.deleteMany({ where: { saccoId: sacco.id } });
  await prisma.savingsTransaction.deleteMany({ where: { saccoId: sacco.id } });
  await prisma.ledgerEntry.deleteMany({ where: { saccoId: sacco.id } });
  await prisma.auditLog.deleteMany({ where: { saccoId: sacco.id } });

  const existingMembers = await prisma.member.findMany({
    where: { saccoId: sacco.id },
    select: { memberNumber: true },
  });
  const targetMemberCount = 140;
  const membersToCreate = Math.max(targetMemberCount - existingMembers.length, 0);
  const maxSequence = existingMembers.reduce(
    (max, member) => Math.max(max, parseMemberSequence(member.memberNumber)),
    0,
  );

  if (membersToCreate > 0) {
    const memberRows = Array.from({ length: membersToCreate }, (_, index) => {
      const sequence = maxSequence + index + 1;
      const memberNumber = `M-${String(sequence).padStart(4, "0")}`;
      const createdAt = daysAgo(randomInt(1, 400));
      const firstName = firstNames[(sequence - 1) % firstNames.length];
      const lastName = lastNames[(sequence - 1) % lastNames.length];
      return {
        saccoId: sacco.id,
        memberNumber,
        fullName: `${firstName} ${lastName}`,
        phone: random() < 0.9 ? `25670${String(1000000 + sequence).slice(-7)}` : null,
        email:
          random() < 0.85
            ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${sequence}@example.com`
            : null,
        status: random() < 0.85 ? "ACTIVE" : "INACTIVE",
        joinedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      };
    });

    await prisma.member.createMany({ data: memberRows });
  }

  const members = await prisma.member.findMany({
    where: { saccoId: sacco.id },
    orderBy: { memberNumber: "asc" },
  });

  const validSequences = members
    .map((member) => parseMemberSequence(member.memberNumber))
    .filter((value) => value > 0);
  const usedSequences = new Set(validSequences);
  let nextSequence = validSequences.length > 0 ? Math.max(...validSequences) + 1 : 1;

  for (const member of members) {
    let sequence = parseMemberSequence(member.memberNumber);
    if (sequence <= 0 || usedSequences.has(sequence) === false) {
      while (usedSequences.has(nextSequence)) {
        nextSequence += 1;
      }
      sequence = nextSequence;
      usedSequences.add(sequence);
      nextSequence += 1;

      await prisma.member.update({
        where: { id: member.id },
        data: { memberNumber: `M-${String(sequence).padStart(4, "0")}` },
      });
    }

    if (/^Member\s+\d+$/i.test(member.fullName.trim())) {
      const firstName = firstNames[(sequence - 1) % firstNames.length];
      const lastName = lastNames[(sequence - 1) % lastNames.length];
      await prisma.member.update({
        where: { id: member.id },
        data: {
          fullName: `${firstName} ${lastName}`,
          email:
            member.email ??
            `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${sequence}@example.com`,
        },
      });
    }
  }

  const normalizedMembers = await prisma.member.findMany({
    where: { saccoId: sacco.id },
    orderBy: { memberNumber: "asc" },
  });

  const savingsRows: Array<{
    saccoId: string;
    memberId: string;
    type: SavingsTransactionType;
    amount: Prisma.Decimal;
    note: string;
    createdAt: Date;
  }> = [];

  for (const member of normalizedMembers) {
    const deposits = randomInt(3, 9);
    for (let i = 0; i < deposits; i += 1) {
      const amount = new Prisma.Decimal(randomInt(30000, 700000));
      savingsRows.push({
        saccoId: sacco.id,
        memberId: member.id,
        type: SavingsTransactionType.DEPOSIT,
        amount,
        note: "Seed deposit",
        createdAt: daysAgo(randomInt(0, 220)),
      });
    }

    if (random() < 0.78) {
      const withdrawals = randomInt(1, 4);
      for (let i = 0; i < withdrawals; i += 1) {
        savingsRows.push({
          saccoId: sacco.id,
          memberId: member.id,
          type: SavingsTransactionType.WITHDRAWAL,
          amount: new Prisma.Decimal(randomInt(10000, 300000)),
          note: "Seed withdrawal",
          createdAt: daysAgo(randomInt(0, 180)),
        });
      }
    }

    if (random() < 0.2) {
      savingsRows.push({
        saccoId: sacco.id,
        memberId: member.id,
        type: SavingsTransactionType.ADJUSTMENT,
        amount: new Prisma.Decimal(randomInt(-15000, 60000)),
        note: "Seed adjustment",
        createdAt: daysAgo(randomInt(0, 150)),
      });
    }
  }

  if (savingsRows.length > 0) {
    await prisma.savingsTransaction.createMany({ data: savingsRows });
  }

  const seededLoans: Array<{ id: string; memberId: string; status: LoanStatus; principal: Prisma.Decimal }> = [];

  for (let i = 0; i < 95; i += 1) {
    const member = normalizedMembers[randomInt(0, normalizedMembers.length - 1)];
    const status = pickWeighted<LoanStatus>([
      { value: LoanStatus.PENDING, weight: 12 },
      { value: LoanStatus.APPROVED, weight: 10 },
      { value: LoanStatus.DISBURSED, weight: 20 },
      { value: LoanStatus.ACTIVE, weight: 30 },
      { value: LoanStatus.DEFAULTED, weight: 12 },
      { value: LoanStatus.CLEARED, weight: 16 },
    ]);

    const termMonths = randomInt(3, 18);
    const principal = new Prisma.Decimal(randomInt(250000, 5000000));
    const interest = principal.mul(0.18).mul(termMonths).div(12);
    const appliedAt = daysAgo(randomInt(1, 260));
    const approvedAt =
      status === LoanStatus.PENDING
        ? null
        : daysAgo(randomInt(1, 240));
    const disbursedAt =
      status === LoanStatus.PENDING || status === LoanStatus.APPROVED
        ? null
        : daysAgo(randomInt(1, 220));
    const dueBase = disbursedAt ?? approvedAt ?? appliedAt;
    const dueAt = new Date(dueBase);
    dueAt.setDate(dueAt.getDate() + termMonths * 30);

    let outstandingPrincipal = principal;
    let outstandingInterest = interest;
    let outstandingPenalty = new Prisma.Decimal(0);

    if (status === LoanStatus.CLEARED) {
      outstandingPrincipal = new Prisma.Decimal(0);
      outstandingInterest = new Prisma.Decimal(0);
      outstandingPenalty = new Prisma.Decimal(0);
    } else if (status === LoanStatus.ACTIVE || status === LoanStatus.DISBURSED) {
      outstandingPrincipal = principal.mul(randomInt(25, 85)).div(100);
      outstandingInterest = interest.mul(randomInt(10, 70)).div(100);
      outstandingPenalty = new Prisma.Decimal(randomInt(0, 90000));
    } else if (status === LoanStatus.DEFAULTED) {
      outstandingPrincipal = principal.mul(randomInt(50, 100)).div(100);
      outstandingInterest = interest.mul(randomInt(60, 100)).div(100);
      outstandingPenalty = new Prisma.Decimal(randomInt(60000, 260000));
    } else if (status === LoanStatus.APPROVED || status === LoanStatus.PENDING) {
      outstandingPrincipal = principal;
      outstandingInterest = new Prisma.Decimal(0);
      outstandingPenalty = new Prisma.Decimal(0);
    }

    const loan = await prisma.loan.create({
      data: {
        saccoId: sacco.id,
        memberId: member.id,
        termMonths,
        dueAt,
        principalAmount: principal,
        interestAmount: interest,
        outstandingPrincipal,
        outstandingInterest,
        outstandingPenalty,
        status,
        appliedAt,
        approvedAt,
        disbursedAt,
      },
      select: {
        id: true,
        memberId: true,
        status: true,
        principalAmount: true,
      },
    });

    seededLoans.push({
      id: loan.id,
      memberId: loan.memberId,
      status: loan.status,
      principal: loan.principalAmount,
    });
  }

  const repaymentRows: Array<{
    saccoId: string;
    loanId: string;
    memberId: string;
    amount: Prisma.Decimal;
    paidAt: Date;
    note: string;
  }> = [];

  for (const loan of seededLoans) {
    if (
      loan.status === LoanStatus.PENDING ||
      loan.status === LoanStatus.APPROVED
    ) {
      continue;
    }

    const count =
      loan.status === LoanStatus.CLEARED ? 1 : randomInt(1, 4);
    for (let i = 0; i < count; i += 1) {
      const amount =
        loan.status === LoanStatus.CLEARED
          ? loan.principal.mul(1.1)
          : loan.principal.mul(randomInt(3, 14)).div(100);

      repaymentRows.push({
        saccoId: sacco.id,
        loanId: loan.id,
        memberId: loan.memberId,
        amount,
        paidAt: daysAgo(randomInt(0, 180)),
        note: "Seed repayment",
      });
    }
  }

  if (repaymentRows.length > 0) {
    await prisma.loanRepayment.createMany({ data: repaymentRows });
  }

  const shareRows: Array<{
    saccoId: string;
    memberId: string;
    eventType: string;
    amount: Prisma.Decimal;
    reference: string;
    createdAt: Date;
  }> = [];

  for (const member of normalizedMembers) {
    const purchaseCount = random() < 0.78 ? randomInt(1, 4) : 0;
    let purchased = new Prisma.Decimal(0);
    for (let i = 0; i < purchaseCount; i += 1) {
      const amount = new Prisma.Decimal(randomInt(40000, 900000));
      purchased = purchased.plus(amount);
      shareRows.push({
        saccoId: sacco.id,
        memberId: member.id,
        eventType: "SHARE_PURCHASE",
        amount,
        reference: "Seed share purchase",
        createdAt: daysAgo(randomInt(0, 240)),
      });
    }

    if (purchaseCount > 0 && random() < 0.35) {
      const redemption = purchased.mul(randomInt(5, 35)).div(100);
      shareRows.push({
        saccoId: sacco.id,
        memberId: member.id,
        eventType: "SHARE_REDEMPTION",
        amount: redemption,
        reference: "Seed share redemption",
        createdAt: daysAgo(randomInt(0, 180)),
      });
    }

    if (random() < 0.12) {
      shareRows.push({
        saccoId: sacco.id,
        memberId: member.id,
        eventType: "SHARE_ADJUSTMENT",
        amount: new Prisma.Decimal(randomInt(-30000, 80000)),
        reference: "Seed share adjustment",
        createdAt: daysAgo(randomInt(0, 150)),
      });
    }
  }

  if (shareRows.length > 0) {
    await prisma.ledgerEntry.createMany({ data: shareRows });
  }

  const actors = await prisma.appUser.findMany({
    where: { saccoId: sacco.id },
    select: { id: true },
  });
  const actorId = actors[0]?.id;

  const auditRows = Array.from({ length: 180 }, (_, index) => {
    const action = pickWeighted([
      { value: "CREATE", weight: 36 },
      { value: "UPDATE", weight: 46 },
      { value: "DELETE", weight: 8 },
      { value: "RESET_PASSWORD", weight: 6 },
      { value: "REVOKE_SESSIONS", weight: 4 },
    ]);
    const entity = pickWeighted([
      { value: "Member", weight: 30 },
      { value: "Loan", weight: 28 },
      { value: "SavingsTransaction", weight: 22 },
      { value: "ShareTransaction", weight: 10 },
      { value: "AppUser", weight: 10 },
    ]);

    return {
      saccoId: sacco.id,
      actorId,
      action,
      entity,
      entityId: `${entity.toLowerCase()}-${index + 1}`,
      beforeJson: action === "CREATE" ? null : JSON.stringify({ status: "before" }),
      afterJson: action === "DELETE" ? null : JSON.stringify({ status: "after" }),
      createdAt: daysAgo(randomInt(0, 120)),
    };
  });

  await prisma.auditLog.createMany({ data: auditRows });

  const counts = await Promise.all([
    prisma.member.count({ where: { saccoId: sacco.id } }),
    prisma.savingsTransaction.count({ where: { saccoId: sacco.id } }),
    prisma.loan.count({ where: { saccoId: sacco.id } }),
    prisma.loanRepayment.count({ where: { saccoId: sacco.id } }),
    prisma.ledgerEntry.count({
      where: {
        saccoId: sacco.id,
        eventType: { in: ["SHARE_PURCHASE", "SHARE_REDEMPTION", "SHARE_ADJUSTMENT"] },
      },
    }),
    prisma.auditLog.count({ where: { saccoId: sacco.id } }),
  ]);

  console.log(`Rich demo seed completed for ${targetCode}`);
  console.log(`Members: ${counts[0]}`);
  console.log(`Savings transactions: ${counts[1]}`);
  console.log(`Loans: ${counts[2]}`);
  console.log(`Loan repayments: ${counts[3]}`);
  console.log(`Share ledger entries: ${counts[4]}`);
  console.log(`Audit logs: ${counts[5]}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
