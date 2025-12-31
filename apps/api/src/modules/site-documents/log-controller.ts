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
        const rows = logs.map((log: unknown) => {
          const logItem = log as {
            created_at: Date;
            user: { first_name: string; last_name: string; email: string };
            event_type: string;
            document_id: string | null;
            ip_address: string | null;
            device_info: string | null;
            metadata: unknown;
          };
          return [
            logItem.created_at.toISOString(),
            `${logItem.user.first_name} ${logItem.user.last_name}`,
            logItem.user.email,
            logItem.event_type,
            logItem.document_id || "",
            logItem.ip_address || "",
            logItem.device_info || "",
            JSON.stringify(logItem.metadata || {}),
          ];
        });

        const csvContent = [
          headers.join(","),
          ...rows.map((row: unknown) => {
            const rowArray = row as unknown[];
            return rowArray.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
          }),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="document-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
      } else {
        // JSON format
        const jsonData = logs.map((log: unknown) => {
          const logItem = log as {
            id: string;
            user_id: string;
            user: {
              first_name: string;
              last_name: string;
              email: string;
              roles: unknown;
            };
            document_id: string | null;
            event_type: string;
            ip_address: string | null;
            user_agent: string | null;
            device_info: string | null;
            metadata: unknown;
            created_at: Date;
          };
          return {
            id: logItem.id,
            user_id: logItem.user_id,
            user: {
              first_name: logItem.user.first_name,
              last_name: logItem.user.last_name,
              email: logItem.user.email,
              roles: logItem.user.roles,
            },
            document_id: logItem.document_id,
            event_type: logItem.event_type,
            ip_address: logItem.ip_address,
            user_agent: logItem.user_agent,
            device_info: logItem.device_info,
            metadata: logItem.metadata,
            created_at: logItem.created_at.toISOString(),
          };
        });

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

