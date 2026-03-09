import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { UnauthorizedError } from "@/src/server/auth/rbac";
import { logger } from "@/src/server/observability/logger";

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

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

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
  const getRequestLike = (args: unknown[]) => {
    const candidate = args[0] as
      | {
          url?: string;
          method?: string;
          headers?: Headers;
        }
      | undefined;
    if (!candidate || typeof candidate !== "object") {
      return null;
    }
    return candidate;
  };

  return async (...args: TArgs) => {
    const requestId = randomUUID();
    const requestLike = getRequestLike(args as unknown[]);
    const route = requestLike?.url ?? "unknown";
    const method = requestLike?.method ?? "unknown";

    try {
      const response = await handler(...args);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        const response = fail(error.message, error.status, "AUTH_ERROR");
        response.headers.set("x-request-id", requestId);
        return response;
      }

      if (error instanceof ZodError) {
        const response = fail("Validation error", 400, "VALIDATION_ERROR", error.issues);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      if (error instanceof AppError) {
        const response = fail(error.message, error.status, error.code);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      if (error instanceof Error) {
        logger.warn("Handled API business error", {
          requestId,
          route,
          method,
          errorMessage: error.message,
        });
        const response = fail(error.message, 400, "BAD_REQUEST");
        response.headers.set("x-request-id", requestId);
        return response;
      }

      logger.error("Unhandled API error", {
        requestId,
        route,
        method,
        errorMessage: String(error),
      });

      const response = fail("Internal server error", 500, "INTERNAL_ERROR");
      response.headers.set("x-request-id", requestId);
      return response;
    }
  };
};
