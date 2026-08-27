import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../../lib/auth/middleware";
import { AppError } from "../../../lib/http/error-handler";
import { productService } from "../service";
import { buildAuditCsv, humanizeAuditEventType, redactAuditSecrets } from "../../../lib/audit-csv";
import {
  getProductLogsQuerySchema,
  exportProductLogsQuerySchema,
} from "../schemas";
import { productNameFromLogMetadata } from "../product-log-presentation";

const router = Router();

/** Mirrors PRODUCT_EVENT_TYPES labels in apps/admin/src/components/audit/product-logs-panel.tsx. */
const PRODUCT_EVENT_LABELS: Record<string, string> = {
  PRODUCT_CREATED: "Product Created",
  PRODUCT_UPDATED: "Product Updated",
  PRODUCT_DELETED: "Product Deleted",
  PRODUCT_INACTIVATED: "Product Inactivated",
  PRODUCT_REACTIVATED: "Product Reactivated",
};

function productEventLabel(eventType: string): string {
  return humanizeAuditEventType(eventType, PRODUCT_EVENT_LABELS);
}

/**
 * GET /v1/admin/product-logs
 * List product logs with pagination and filters
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
 * Export product logs as CSV or JSON
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
        const csvContent = buildAuditCsv(
          logs.map((log: unknown) => {
            const logItem = log as {
              created_at: Date;
              user: { first_name: string; last_name: string; email: string };
              event_type: string;
              product_id: string | null;
              ip_address: string | null;
              device_info: string | null;
              user_agent: string | null;
              metadata: Record<string, unknown> | null;
              actor_type?: string | null;
              source?: string | null;
              target_type?: string | null;
              target_id?: string | null;
              correlation_id?: string | null;
            };
            const meta = logItem.metadata ?? {};
            const productName = productNameFromLogMetadata(meta) ?? "";
            return {
              timestamp: logItem.created_at.toISOString(),
              event: productEventLabel(logItem.event_type),
              eventType: logItem.event_type,
              actor: `${logItem.user.first_name} ${logItem.user.last_name}`.trim(),
              actorType: logItem.actor_type ?? "ADMIN",
              actorEmail: logItem.user.email,
              source: logItem.source,
              targetType: logItem.target_type ?? "PRODUCT",
              targetReference: logItem.target_id ?? logItem.product_id,
              correlationId: logItem.correlation_id,
              metadata: logItem.metadata,
              extra: {
                "Product Name": productName,
                "Product ID": logItem.product_id,
                "IP Address": logItem.ip_address,
                Device: logItem.device_info,
                "User Agent": logItem.user_agent,
              },
            };
          }),
          ["Product Name", "Product ID", "IP Address", "Device", "User Agent"]
        );

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
          const productName = productNameFromLogMetadata(meta);
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
            metadata: redactAuditSecrets(logItem.metadata),
            created_at: logItem.created_at.toISOString(),
            actor_type: (logItem as { actor_type?: string | null }).actor_type ?? null,
            source: (logItem as { source?: string | null }).source ?? null,
            target_type: (logItem as { target_type?: string | null }).target_type ?? null,
            target_id: (logItem as { target_id?: string | null }).target_id ?? null,
            correlation_id: (logItem as { correlation_id?: string | null }).correlation_id ?? null,
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

