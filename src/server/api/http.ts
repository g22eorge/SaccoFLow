import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/src/server/auth/rbac";

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};

export const ok = <T>(data: T, status = 200) =>
  NextResponse.json<ApiSuccess<T>>({ success: true, data }, { status });

export const created = <T>(data: T) => ok(data, 201);

export const fail = (
  message: string,
  status: number,
  code?: string,
  details?: unknown,
) =>
  NextResponse.json<ApiFailure>(
    {
      success: false,
      error: { message, code, details },
    },
    { status },
  );

export const withApiHandler = <TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>,
) => {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return fail(error.message, error.status, "AUTH_ERROR");
      }

      if (error instanceof ZodError) {
        return fail("Validation error", 400, "VALIDATION_ERROR", error.issues);
      }

      if (error instanceof Error) {
        return fail(error.message, 400, "BAD_REQUEST");
      }

      return fail("Internal server error", 500, "INTERNAL_ERROR");
    }
  };
};
