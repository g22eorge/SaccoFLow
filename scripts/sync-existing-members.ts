import { UsersService } from "@/src/server/services/users.service";
import { prisma } from "@/src/server/db/prisma";

const parseSaccoId = () => {
  const index = process.argv.findIndex((argument) => argument === "--sacco-id");
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
};

const run = async () => {
  const saccoId = parseSaccoId();
  const result = await UsersService.syncExistingMemberUsers({ saccoId });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
};

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
