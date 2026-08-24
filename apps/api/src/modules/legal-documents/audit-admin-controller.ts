import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentAuditAdminService } from "./audit-admin-service";
import {
  exportLegalDocumentAuditLogsQuerySchema,
  listLegalDocumentAuditLogsQuerySchema,
} from "./schemas";

const router = Router();

/** Mirrors ACTION_OPTIONS labels in apps/admin/src/components/audit/legal-document-audit-panel.tsx. */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  LEGAL_DOCUMENT_CREATED: "Document created",
  LEGAL_DOCUMENT_UPDATED: "Document updated",
  LEGAL_VERSION_UPLOADED: "Version uploaded",
  LEGAL_VERSION_FILE_REPLACED: "Version file replaced",
  LEGAL_VERSION_PUBLISHED: "Version published",
  LEGAL_VERSION_ARCHIVED: "Version archived",
  LEGAL_VERSION_RESTORED: "Version restored",
};

function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
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
        const headers = [
          "Audit ID",
          "Action",
          "Legal Document ID",
          "Legal Document Version ID",
          "Document Type",
          "Version Number",
          "Document Hash",
          "Actor User ID",
          "Actor Name",
          "Actor Email",
          "Before JSON",
          "After JSON",
          "Reason",
          "IP Address",
          "User Agent",
          "Correlation ID",
          "Created At",
        ];
        const csvRows = rows.map((row) => [
          row.id,
          auditActionLabel(row.action),
          row.legalDocumentId ?? "",
          row.legalDocumentVersionId ?? "",
          row.documentType ?? "",
          row.versionNumber ?? "",
          row.documentHash ?? "",
          row.actorUserId ?? "",
          row.actorName ?? "",
          row.actorEmail ?? "",
          row.beforeJson ? JSON.stringify(row.beforeJson) : "",
          row.afterJson ? JSON.stringify(row.afterJson) : "",
          row.reason ?? "",
          row.ipAddress ?? "",
          row.userAgent ?? "",
          row.correlationId ?? "",
          row.createdAt,
        ]);

        const csvContent = [
          headers.join(","),
          ...csvRows.map((cells) =>
            cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

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
