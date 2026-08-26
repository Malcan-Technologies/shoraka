import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentAuditAdminService } from "./audit-admin-service";
import { buildAuditCsv, humanizeAuditEventType } from "../../lib/audit-csv";
import { legalDocumentTypeLabel } from "@cashsouk/types";
import {
  exportLegalDocumentAuditLogsQuerySchema,
  listLegalDocumentAuditLogsQuerySchema,
} from "./schemas";

const router = Router();

/** Mirrors ACTION_OPTIONS labels in apps/admin/src/components/audit/legal-document-audit-panel.tsx. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  LEGAL_DOCUMENT_CREATED: "Document Created",
  LEGAL_DOCUMENT_UPDATED: "Document Updated",
  LEGAL_VERSION_UPLOADED: "Version Uploaded",
  LEGAL_VERSION_FILE_REPLACED: "Version File Replaced",
  LEGAL_VERSION_PUBLISHED: "Version Published",
  LEGAL_VERSION_ARCHIVED: "Version Archived",
  LEGAL_VERSION_RESTORED: "Version Restored",
};

function auditActionLabel(action: string): string {
  return humanizeAuditEventType(action, AUDIT_ACTION_LABELS);
}

/**
 * GET /v1/admin/legal-document-audit-logs
 * Paginated admin legal-document change history (read-only).
 */
router.get(
  "/",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = listLegalDocumentAuditLogsQuerySchema.parse(req.query);
      const result = await legalDocumentAuditAdminService.list(validated);
      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : error instanceof Error
            ? new AppError(400, "VALIDATION_ERROR", error.message)
            : error
      );
    }
  }
);

/**
 * GET /v1/admin/legal-document-audit-logs/export
 */
router.get(
  "/export",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportLegalDocumentAuditLogsQuerySchema.parse(req.query);
      const rows = await legalDocumentAuditAdminService.export(validated);

      if (validated.format === "csv") {
        const csvContent = buildAuditCsv(
          rows.map((row) => ({
            timestamp: row.createdAt,
            event: auditActionLabel(row.action),
            eventType: row.action,
            actor: row.actorName,
            actorType: "ADMIN",
            actorEmail: row.actorEmail,
            source: "ADMIN",
            targetType: row.documentType,
            targetReference: row.legalDocumentId,
            reason: row.reason,
            correlationId: row.correlationId,
            metadata: {
              beforeJson: row.beforeJson,
              afterJson: row.afterJson,
            },
            extra: {
              Document: legalDocumentTypeLabel(row.documentType),
              "Audit ID": row.id,
              "Legal Document Version ID": row.legalDocumentVersionId,
              "Version Number": row.versionNumber,
              "Document Hash": row.documentHash,
              "Actor User ID": row.actorUserId,
              "Previous Values": row.beforeJson ? JSON.stringify(row.beforeJson) : "",
              "New Values": row.afterJson ? JSON.stringify(row.afterJson) : "",
              "IP Address": row.ipAddress,
              "User Agent": row.userAgent,
            },
          })),
          [
            "Document",
            "Audit ID",
            "Legal Document Version ID",
            "Version Number",
            "Document Hash",
            "Actor User ID",
            "Previous Values",
            "New Values",
            "IP Address",
            "User Agent",
          ]
        );

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="legal-document-audit-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="legal-document-audit-logs-${new Date().toISOString().split("T")[0]}.json"`
      );
      res.json({
        success: true,
        data: { logs: rows },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : error instanceof Error
            ? new AppError(400, "VALIDATION_ERROR", error.message)
            : error
      );
    }
  }
);

export const legalDocumentAuditAdminRouter = router;
