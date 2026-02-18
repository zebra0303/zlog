import { Context } from "hono";

export function errorHandler(err: Error, c: Context) {
  console.error("❌ Server Error:", err);
  return c.json(
    {
      error: "An internal server error occurred.",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500,
  );
}
