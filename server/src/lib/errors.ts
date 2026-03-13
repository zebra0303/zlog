// Re-export from shared library — framework-agnostic error hierarchy
export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@zebra/core/server";
