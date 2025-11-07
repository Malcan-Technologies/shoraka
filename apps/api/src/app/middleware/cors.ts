import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers["x-correlation-id"] as string) || randomUUID();
  res.locals.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);
  next();
}

