import { cookies } from "next/headers";
import { z } from "zod";
import { fail, ok, withApiHandler } from "@/src/server/api/http";
import {
  ACTIVE_SACCO_COOKIE,
  listAccessibleTenants,
} from "@/src/server/auth/rbac";

const switchSchema = z.object({
  saccoId: z.string().min(8),
});

export const GET = withApiHandler(async () => {
  const result = await listAccessibleTenants();
  return ok(result);
});

export const POST = withApiHandler(async (request: Request) => {
  const parsed = switchSchema.parse(await request.json());
  const result = await listAccessibleTenants();
  const target = result.tenants.find((tenant) => tenant.saccoId === parsed.saccoId);

  if (!target) {
    return fail("Tenant not accessible for current user", 403, "TENANT_ACCESS_DENIED");
  }

  const store = await cookies();
  store.set(ACTIVE_SACCO_COOKIE, JSON.stringify({ saccoId: target.saccoId }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return ok({
    activeSaccoId: target.saccoId,
    activeRole: target.role,
    saccoCode: target.saccoCode,
    saccoName: target.saccoName,
  });
});

export const DELETE = withApiHandler(async () => {
  const store = await cookies();
  store.delete(ACTIVE_SACCO_COOKIE);
  return ok({ cleared: true });
});
