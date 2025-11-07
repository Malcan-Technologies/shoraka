import { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response): void {
  const correlationId = res.locals.correlationId || "unknown";
  
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
    correlationId,
  });
}

