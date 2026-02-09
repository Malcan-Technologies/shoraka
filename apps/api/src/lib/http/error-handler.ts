import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

function formatZodMessage(zodError: ZodError): string {
  const first = zodError.issues[0];
  if (!first) return "Validation failed";
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return path + (first.message || "Invalid value");
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = res.locals.correlationId || req.headers["x-correlation-id"] || "unknown";

  if (err instanceof ZodError) {
    const message = formatZodMessage(err);
    logger.warn(
      { correlationId, path: req.path, method: req.method, issues: err.issues },
      message
    );
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
        details: err.issues,
      },
      correlationId,
    });
    return;
  }

  if (err instanceof AppError) {
    logger.error(
      {
        correlationId,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
      },
      err.message
    );

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      correlationId,
    });
    return;
  }

  logger.error(
    {
      correlationId,
      path: req.path,
      method: req.method,
      stack: err.stack,
    },
    "Internal server error"
  );

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
    },
    correlationId,
  });
}

