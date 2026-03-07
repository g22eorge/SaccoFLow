import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const requiredEnv = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

const args = new Set(process.argv.slice(2));
const isFull = args.has("--full");

const run = async (command: string, commandArgs: string[]) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${commandArgs.join(" ")}`));
    });
  });

async function main() {
  console.log("[auth:preprod:check] Starting checks...");

  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  const demoOtp = process.env.DEMO_OTP_PREVIEW;
  const diagnostics = process.env.AUTH_DIAGNOSTICS;
  console.log(`[auth:preprod:check] DEMO_OTP_PREVIEW=${demoOtp ?? "<unset>"}`);
  console.log(`[auth:preprod:check] AUTH_DIAGNOSTICS=${diagnostics ?? "<unset>"}`);
  if (demoOtp === "true") {
    console.warn("[auth:preprod:check] WARNING: DEMO_OTP_PREVIEW is enabled. Disable before production.");
  }
  if (diagnostics === "true") {
    console.warn("[auth:preprod:check] WARNING: AUTH_DIAGNOSTICS is enabled. Disable before production.");
  }

  await prisma.$queryRaw`SELECT 1`;

  const tableCounts = await Promise.all([
    prisma.sacco.count(),
    prisma.appUser.count(),
    prisma.user.count(),
    prisma.account.count(),
    prisma.session.count(),
  ]);

  const loginChallengeDelegate = (prisma as unknown as { loginChallenge?: { count: () => Promise<number> } }).loginChallenge;
  const loginChallengeCount = loginChallengeDelegate ? await loginChallengeDelegate.count() : null;

  console.log("[auth:preprod:check] DB connectivity: OK");
  console.log(`[auth:preprod:check] Sacco records: ${tableCounts[0]}`);
  console.log(`[auth:preprod:check] AppUser records: ${tableCounts[1]}`);
  console.log(`[auth:preprod:check] Auth users: ${tableCounts[2]}`);
  console.log(`[auth:preprod:check] Auth accounts: ${tableCounts[3]}`);
  console.log(`[auth:preprod:check] Auth sessions: ${tableCounts[4]}`);
  console.log(`[auth:preprod:check] LoginChallenge available: ${Boolean(loginChallengeDelegate)}`);
  if (loginChallengeCount !== null) {
    console.log(`[auth:preprod:check] LoginChallenge rows: ${loginChallengeCount}`);
  }

  if (!isFull) {
    console.log("[auth:preprod:check] Quick mode complete. Use --full for lint/test/build.");
    return;
  }

  console.log("[auth:preprod:check] Running lint...");
  await run("bun", ["run", "lint"]);

  console.log("[auth:preprod:check] Running tests...");
  await run("bun", ["run", "test"]);

  console.log("[auth:preprod:check] Running build...");
  await run("bun", ["run", "build"]);

  console.log("[auth:preprod:check] Full checks complete.");
}

main()
  .catch((error) => {
    console.error("[auth:preprod:check] Failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
