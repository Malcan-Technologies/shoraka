import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import {
  legalDocumentAcceptanceAdminService,
  type AcceptanceOrganizationScope,
} from "./acceptance-admin-service";
import {
  exportLegalAcceptancesQuerySchema,
  listLegalAcceptancesQuerySchema,
} from "./schemas";
import { legalDocumentTypeLabel } from "@cashsouk/types";

const router = Router();

/** Mirrors LEGAL_ACCEPTANCE_STATUS_OPTIONS labels in apps/admin/src/lib/legal-acceptance-display.ts. */
const ACCEPTANCE_STATUS_LABELS: Record<string, string> = {
  NOT_OPENED: "Not opened",
  OPENED: "Opened",
  ACCEPTED: "Accepted",
};

function acceptanceStatusLabel(status: string): string {
  return ACCEPTANCE_STATUS_LABELS[status] ?? status;
}

/**
 * GET /v1/admin/legal-document-acceptances
 * Paginated acceptance evidence (read-only).
 */
router.get(
  "/",
  requirePermission("audit.legal_acceptances.view"),
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
  requirePermission("audit.legal_acceptances.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportLegalAcceptancesQuerySchema.parse(req.query);
      const rows = await legalDocumentAcceptanceAdminService.exportAcceptances(validated);

      if (validated.format === "csv") {
        const headers = [
          "Acceptance ID",
          "Document ID",
          "Document Type",
          "Document Type ID",
          "Legal Document Version ID",
          "Version Number",
          "Document Hash",
          "File Name",
          "User ID",
          "User Name Snapshot",
          "User Email Snapshot",
          "Organization ID",
          "Organization Name Snapshot",
          "Organization Type Snapshot",
          "Portal",
          "Status",
          "Opened At",
          "Opened IP",
          "Opened User Agent",
          "Opened Device Info",
          "Accepted At",
          "Accepted IP",
          "Accepted User Agent",
          "Accepted Device Info",
          "Acknowledgement Text",
          "Created At",
        ];
        const csvRows = rows.map((row) => [
          row.id,
          row.legalDocumentId ?? "",
          legalDocumentTypeLabel(row.documentType),
          row.documentType ?? "",
          row.legalDocumentVersionId,
          row.versionNumber ?? "",
          row.documentHash ?? "",
          row.fileName ?? "",
          row.userId ?? "",
          row.userName ?? "",
          row.userEmail ?? "",
          row.organizationId ?? "",
          row.organizationName ?? "",
          row.organizationAccountType ?? "",
          row.portal,
          acceptanceStatusLabel(row.status),
          row.openedAt ?? "",
          row.openedIpAddress ?? "",
          row.openedUserAgent ?? "",
          row.openedDeviceInfo ?? "",
          row.acceptedAt ?? "",
          row.acceptedIpAddress ?? "",
          row.acceptedUserAgent ?? "",
          row.acceptedDeviceInfo ?? "",
          row.acknowledgementText ?? "",
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
  requirePermission("audit.legal_acceptances.view"),
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
  requirePermission("audit.legal_acceptances.view"),
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

/**
 * Organization detail Acceptances tab.
 * Mounted at /v1/admin/organizations/:portal/:id/legal-acceptances.
 * The organization and audience always come from the URL, never from the query.
 */
const organizationRouter = Router({ mergeParams: true });
const canReadOrganizationAcceptances = requirePermission(
  "organizations.view",
  "document_management.view"
);

function organizationScopeFromParams(req: Request): AcceptanceOrganizationScope {
  const { portal, id } = req.params;
  if (portal !== "investor" && portal !== "issuer") {
    throw new AppError(400, "VALIDATION_ERROR", "Portal must be 'investor' or 'issuer'");
  }
  return { organizationId: id, audience: portal === "issuer" ? "ISSUER" : "INVESTOR" };
}

organizationRouter.get(
  "/",
  canReadOrganizationAcceptances,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scope = organizationScopeFromParams(req);
      const validated = {
        ...listLegalAcceptancesQuerySchema.parse(req.query),
        organizationId: scope.organizationId,
        audience: scope.audience,
      };
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

organizationRouter.get(
  "/:acceptanceId",
  canReadOrganizationAcceptances,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const acceptance = await legalDocumentAcceptanceAdminService.getAcceptanceById(
        req.params.acceptanceId,
        organizationScopeFromParams(req)
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

organizationRouter.get(
  "/:acceptanceId/download",
  canReadOrganizationAcceptances,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await legalDocumentAcceptanceAdminService.getAcceptedVersionDownloadUrl(
        req.params.acceptanceId,
        organizationScopeFromParams(req)
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

export const organizationLegalAcceptanceRouter = organizationRouter;
