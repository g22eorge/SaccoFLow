type Check = {
  name: string;
  path: string;
  expected: number[];
};

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const cookie = process.env.SMOKE_COOKIE;

const checks: Check[] = [
  { name: "Dashboard page", path: "/dashboard", expected: [200] },
  { name: "Members page", path: "/dashboard/members", expected: [200] },
  {
    name: "Members API date filter",
    path: "/api/members?page=1&from=2026-01-01&to=2026-12-31",
    expected: [200],
  },
  { name: "Savings page", path: "/dashboard/savings?from=2026-01-01&to=2026-12-31", expected: [200] },
  {
    name: "Savings API date filter",
    path: "/api/savings?page=1&from=2026-01-01&to=2026-12-31",
    expected: [200],
  },
  { name: "Shares page", path: "/dashboard/shares?from=2026-01-01&to=2026-12-31", expected: [200] },
  {
    name: "Shares API date filter",
    path: "/api/shares?page=1&from=2026-01-01&to=2026-12-31",
    expected: [200],
  },
  { name: "Loans page", path: "/dashboard/loans", expected: [200] },
  { name: "Reports page", path: "/dashboard/reports", expected: [200, 302] },
  { name: "Audit page", path: "/dashboard/audit-logs", expected: [200, 302] },
];

const run = async () => {
  if (!cookie) {
    throw new Error("Missing SMOKE_COOKIE env var (set authenticated session cookie)");
  }

  for (const check of checks) {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: "GET",
      redirect: "manual",
      headers: {
        cookie,
      },
    });

    if (!check.expected.includes(response.status)) {
      throw new Error(
        `${check.name} failed: got ${response.status} at ${check.path}`,
      );
    }

    console.log(`OK ${check.name}: ${response.status}`);
  }

  console.log("Smoke checks passed.");
};

run().catch((error) => {
  console.error("Smoke checks failed:", error);
  process.exit(1);
});
