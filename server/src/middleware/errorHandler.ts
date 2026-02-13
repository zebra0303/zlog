import { Context } from "hono";

export function errorHandler(err: Error, c: Context) {
  console.error("❌ Server Error:", err);
  return c.json(
    {
      error: "서버 내부 오류가 발생했습니다.",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500,
  );
}
