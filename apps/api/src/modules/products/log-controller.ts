import { Router, Request, Response, NextFunction } from "express";
import { requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { productService } from "./service";
import {
  getProductLogsQuerySchema,
  exportProductLogsQuerySchema,
} from "./schemas";

const router = Router();

/**
 * GET /v1/admin/product-logs
 * List product logs with pagination and filters
 */
router.get(
  "/",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getProductLogsQuerySchema.parse(req.query);
      const result = await productService.getProductLogs(validated);

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
 * GET /v1/admin/product-logs/export
 * Export product logs as CSV or JSON
 */
router.get(
  "/export",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportProductLogsQuerySchema.parse(req.query);
      const { format, search, eventType, eventTypes, dateRange } = validated;

      const logs = await productService.exportProductLogs({
        search,
        eventType,
        eventTypes,
        dateRange,
      });

      if (format === "csv") {
        const headers = [
          "Timestamp",
          "Admin",
          "Email",
          "Event Type",
          "Product Name",
          "Product ID",
          "IP Address",
          "Device",
          "Metadata",
        ];
        const rows = logs.map((log: unknown) => {
          const logItem = log as {
            created_at: Date;
            user: { first_name: string; last_name: string; email: string };
            event_type: string;
            product_id: string | null;
            ip_address: string | null;
            device_info: string | null;
            metadata: Record<string, unknown> | null;
          };
          const meta = logItem.metadata ?? {};
          const productName =
            (typeof meta.product_name === "string" ? meta.product_name : null) ??
            (typeof meta.name === "string" ? meta.name : null) ??
            "";
          return [
            logItem.created_at.toISOString(),
            `${logItem.user.first_name} ${logItem.user.last_name}`,
            logItem.user.email,
            logItem.event_type,
            productName,
            logItem.product_id || "",
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
          `attachment; filename="product-logs-${new Date().toISOString().split("T")[0]}.csv"`
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
            product_id: string | null;
            event_type: string;
            ip_address: string | null;
            user_agent: string | null;
            device_info: string | null;
            metadata: Record<string, unknown> | null;
            created_at: Date;
          };
          const meta = logItem.metadata ?? {};
          const workflow = (meta.workflow as unknown[]) ?? [];
          const first = workflow[0] as { config?: { name?: string; type?: { name?: string } } } | undefined;
          const productName =
            (typeof first?.config?.name === "string" ? first.config.name : null) ??
            (typeof first?.config?.type?.name === "string" ? first?.config?.type?.name : null) ??
            null;
          return {
            id: logItem.id,
            user_id: logItem.user_id,
            user: {
              first_name: logItem.user.first_name,
              last_name: logItem.user.last_name,
              email: logItem.user.email,
              roles: logItem.user.roles,
            },
            product_id: logItem.product_id,
            product_name: productName,
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
          `attachment; filename="product-logs-${new Date().toISOString().split("T")[0]}.json"`
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

export const productLogRouter = router;
