import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { legalDocumentAcceptanceAdminService } from "./acceptance-admin-service";
import {
  exportLegalAcceptancesQuerySchema,
  listLegalAcceptancesQuerySchema,
} from "./schemas";

const router = Router();

/**
 * GET /v1/admin/legal-document-acceptances
 * Paginated acceptance evidence (read-only).
 */
router.get(
  "/",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = listLegalAcceptancesQuerySchema.parse(req.query);
      const result = await legalDocumentAcceptanceAdminService.listAcceptances(validated);
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
 * GET /v1/admin/legal-document-acceptances/export
 * CSV or JSON export of acceptance evidence.
 */
router.get(
  "/export",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportLegalAcceptancesQuerySchema.parse(req.query);
      const rows = await legalDocumentAcceptanceAdminService.exportAcceptances(validated);

      if (validated.format === "csv") {
        const headers = [
          "Acceptance ID",
          "Document Type",
          "Version",
          "Hash",
          "Organization ID",
          "Organization Name",
          "Organization Type",
          "User ID",
          "User Name",
          "User Email",
          "Accepted At",
          "Status",
          "IP Address",
          "User Agent",
          "Acknowledgement",
        ];
        const csvRows = rows.map((row) => [
          row.id,
          row.documentType ?? "",
          row.versionNumber ?? "",
          row.documentHash ?? "",
          row.organizationId ?? "",
          row.organizationName ?? "",
          row.organizationType,
          row.userId,
          row.userName ?? "",
          row.userEmail ?? "",
          row.acceptedAt ?? "",
          row.status,
          row.ipAddress ?? "",
          row.userAgent ?? "",
          row.acknowledgementText ?? "",
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
          `attachment; filename="legal-document-acceptances-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="legal-document-acceptances-${new Date().toISOString().split("T")[0]}.json"`
      );
      res.json({
        success: true,
        data: { acceptances: rows },
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
 * GET /v1/admin/legal-document-acceptances/:id
 */
router.get(
  "/:id",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const acceptance = await legalDocumentAcceptanceAdminService.getAcceptanceById(
        req.params.id
      );
      res.json({
        success: true,
        data: { acceptance },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /v1/admin/legal-document-acceptances/:id/download
 * Exact accepted PDF version (may be archived).
 */
router.get(
  "/:id/download",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result =
        await legalDocumentAcceptanceAdminService.getAcceptedVersionDownloadUrl(
          req.params.id
        );
      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const legalDocumentAcceptanceAdminRouter = router;
