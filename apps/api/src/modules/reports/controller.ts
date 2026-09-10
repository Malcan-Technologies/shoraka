import { NextFunction, Request, Response, Router } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { buildReportCsv, buildReportXlsx, reportDownloadName } from "./export";
import { reportKeyParamSchema, reportQuerySchema } from "./schemas";
import { listReportCatalog, runReport } from "./service";

export const adminReportsRouter = Router();

adminReportsRouter.get(
  "/",
  requirePermission("reports.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json({
        success: true,
        data: listReportCatalog(),
        correlationId: res.locals.correlationId || "unknown",
      });
    } catch (error) {
      next(error);
    }
  }
);

adminReportsRouter.get(
  "/:key",
  requirePermission("reports.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { key } = reportKeyParamSchema.parse(req.params);
      const query = reportQuerySchema.parse(req.query);
      const result = await runReport(key, query);
      if (query.format === "csv") {
        const csv = buildReportCsv(result);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${reportDownloadName(result, "csv", query.groupBy)}"`
        );
        res.send(csv);
        return;
      }
      if (query.format === "xlsx") {
        const xlsx = await buildReportXlsx(result);
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${reportDownloadName(result, "xlsx", query.groupBy)}"`
        );
        res.send(xlsx);
        return;
      }
      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId || "unknown",
      });
    } catch (error) {
      next(error);
    }
  }
);
