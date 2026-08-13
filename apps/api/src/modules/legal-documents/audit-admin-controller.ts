import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentAuditAdminService } from "./audit-admin-service";
import {
  exportLegalDocumentAuditLogsQuerySchema,
  listLegalDocumentAuditLogsQuerySchema,
} from "./schemas";

const router = Router();

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
          "Event Type",
          "Legal Document ID",
          "Legal Document Version ID",
          "Target Type",
          "Target ID",
          "Actor User ID",
          "Actor Name",
          "Actor Email",
          "IP Address",
          "User Agent",
          "Correlation ID",
          "Occurred At",
          "Created At",
          "Metadata",
        ];
        const csvRows = rows.map((row) => [
          row.id,
          row.eventType,
          row.legalDocumentId,
          row.legalDocumentVersionId ?? "",
          row.target.type,
          row.target.id,
          row.actor.userId ?? "",
          row.actor.displayName ?? "",
          row.actor.email ?? "",
          row.ipAddress ?? "",
          row.userAgent ?? "",
          row.correlationId ?? "",
          row.occurredAt,
          row.createdAt,
          JSON.stringify(row.metadata),
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
