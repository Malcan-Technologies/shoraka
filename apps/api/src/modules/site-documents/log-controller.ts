import { Router, Request, Response, NextFunction } from "express";
import { requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { siteDocumentService } from "./service";
import {
  getDocumentLogsQuerySchema,
  exportDocumentLogsQuerySchema,
} from "./schemas";

const router = Router();

/**
 * GET /v1/admin/document-logs
 * List document logs with pagination and filters
 */
router.get(
  "/",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getDocumentLogsQuerySchema.parse(req.query);
      const result = await siteDocumentService.getDocumentLogs(validated);

      res.json({
        success: true,
        data: {
          logs: result.logs,
          pagination: result.pagination,
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
      );
    }
  }
);

/**
 * GET /v1/admin/document-logs/export
 * Export document logs as CSV or JSON
 */
router.get(
  "/export",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportDocumentLogsQuerySchema.parse(req.query);
      const { format, search, eventType, eventTypes, dateRange } = validated;

      const logs = await siteDocumentService.exportDocumentLogs({
        search,
        eventType,
        eventTypes,
        dateRange,
      });

      if (format === "csv") {
        // Generate CSV
        const headers = [
          "Timestamp",
          "Admin",
          "Email",
          "Event Type",
          "Document ID",
          "IP Address",
          "Device",
          "Metadata",
        ];
        const rows = logs.map((log) => [
          log.created_at.toISOString(),
          `${log.user.first_name} ${log.user.last_name}`,
          log.user.email,
          log.event_type,
          log.document_id || "",
          log.ip_address || "",
          log.device_info || "",
          JSON.stringify(log.metadata || {}),
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="document-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
      } else {
        // JSON format
        const jsonData = logs.map((log) => ({
          id: log.id,
          user_id: log.user_id,
          user: {
            first_name: log.user.first_name,
            last_name: log.user.last_name,
            email: log.user.email,
            roles: log.user.roles,
          },
          document_id: log.document_id,
          event_type: log.event_type,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          device_info: log.device_info,
          metadata: log.metadata,
          created_at: log.created_at.toISOString(),
        }));

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="document-logs-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.json(jsonData);
      }
    } catch (error) {
      next(
        error instanceof Error
          ? new AppError(400, "VALIDATION_ERROR", error.message)
          : error
      );
    }
  }
);

export const documentLogRouter = router;

