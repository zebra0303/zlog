import { Context } from "hono";
import { AppError } from "../lib/errors.js";
import { ZodError } from "zod";

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          details: (err as any).errors,
        },
      },
      400,
    );
  }

  console.error("❌ Server Error:", err);
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal server error occurred.",
        ...(process.env.NODE_ENV === "development" && { cause: err.message }),
      },
    },
    500,
  );
}
