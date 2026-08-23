import type { Response } from "express";
import { AUDIT_EXPORT_LIMIT } from "./order";

export function applyAuditExportHeaders(res: Response, rowCount: number): void {
  res.setHeader("X-Audit-Export-Limit", String(AUDIT_EXPORT_LIMIT));
  if (rowCount >= AUDIT_EXPORT_LIMIT) {
    res.setHeader("X-Audit-Export-Truncated", "true");
  }
}
