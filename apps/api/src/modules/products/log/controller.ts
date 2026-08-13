import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../../lib/auth/middleware";
import { AppError } from "../../../lib/http/error-handler";
import { productService } from "../service";
import {
  getProductLogsQuerySchema,
  exportProductLogsQuerySchema,
} from "../schemas";
import type { ProductAuditLogDto } from "../audit/reader";

const router = Router();

function productNameFromMetadata(metadata: Record<string, unknown>): string {
  return typeof metadata.productName === "string" ? metadata.productName : "";
}

function actorDisplayName(log: ProductAuditLogDto): string {
  return log.actor.displayName || log.actor.userId || "";
}

/**
 * GET /v1/admin/product-logs
 * List product audit logs with pagination and filters.
 */
router.get(
  "/",
  requirePermission("audit.product.view"),
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
 * Export product audit logs as CSV or JSON.
 */
router.get(
  "/export",
  requirePermission("audit.product.view"),
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
        const rows = logs.map((log) => [
          log.occurredAt,
          actorDisplayName(log),
          log.actor.email || "",
          log.eventType,
          productNameFromMetadata(log.metadata),
          log.productId,
          log.ipAddress || "",
          log.deviceInfo || "",
          JSON.stringify(log.metadata),
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="product-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
      } else {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="product-logs-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.json(logs);
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
