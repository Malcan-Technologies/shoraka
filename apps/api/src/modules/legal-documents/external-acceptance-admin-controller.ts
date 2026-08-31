import { Router, Request, Response, NextFunction } from "express";
import { legalDocumentTypeLabel } from "@cashsouk/types";
import { requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { buildCsv } from "../../lib/audit-csv";
import {
  exportLegalExternalAcceptancesQuerySchema,
  listLegalExternalAcceptancesQuerySchema,
} from "./external-acceptance-admin-schemas";
import { legalExternalAcceptanceAdminService } from "./external-acceptance-admin-service";

const router = Router();

const STATUS_LABELS: Record<string, string> = {
  OPENED: "Opened",
  ACCEPTED: "Accepted",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function eventLabel(status: string): string {
  if (status === "ACCEPTED") return "Legal document accepted";
  if (status === "OPENED") return "Legal document opened";
  return status;
}

router.get(
  "/",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listLegalExternalAcceptancesQuerySchema.parse(req.query);
      const result = await legalExternalAcceptanceAdminService.listAcceptances(query);
      res.json({ success: true, data: result, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/export",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportLegalExternalAcceptancesQuerySchema.parse(req.query);
      const rows = await legalExternalAcceptanceAdminService.exportAcceptances(validated);

      if (validated.format === "csv") {
        const headers = [
          "Acceptance ID",
          "Timestamp",
          "Event",
          "Status",
          "Party Name",
          "Party Email",
          "Party Role",
          "Masked IC",
          "Organisation",
          "Organisation ID",
          "Document",
          "Document Type ID",
          "Version",
          "Version ID",
          "Document ID",
          "File Name",
          "Application",
          "Envelope",
          "Source Type",
          "Source ID",
          "Opened At",
          "Opened IP",
          "Opened User Agent",
          "Opened Device Info",
          "Accepted At",
          "Accepted IP",
          "Accepted User Agent",
          "Accepted Device Info",
          "Created At",
          "Hash",
          "Acknowledgement Wording",
        ];
        const csvRows = rows.map((row) => [
          row.id,
          row.acceptedAt ?? row.createdAt,
          eventLabel(row.status),
          statusLabel(row.status),
          row.partyName,
          row.partyEmail,
          row.partyRole ?? "",
          row.partyIcMasked ?? "",
          row.organizationName ?? "",
          row.organizationId ?? "",
          legalDocumentTypeLabel(row.documentType) || row.documentTitle,
          row.documentType ?? "",
          row.versionNumber ?? "",
          row.legalDocumentVersionId,
          row.legalDocumentId ?? "",
          row.fileName ?? "",
          row.applicationId ?? "",
          row.envelopeId ?? "",
          row.sourceType,
          row.sourceId,
          row.openedAt ?? "",
          row.openedIpAddress ?? "",
          row.openedUserAgent ?? "",
          row.openedDeviceInfo ?? "",
          row.acceptedAt ?? "",
          row.acceptedIpAddress ?? "",
          row.acceptedUserAgent ?? "",
          row.acceptedDeviceInfo ?? "",
          row.createdAt,
          row.documentHash ?? "",
          row.acknowledgementText ?? "",
        ]);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="legal-external-acceptances-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(buildCsv(headers, csvRows), "utf-8"));
        return;
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="legal-external-acceptances-${new Date().toISOString().split("T")[0]}.json"`
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

router.get(
  "/:id",
  requirePermission("document_management.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const acceptance = await legalExternalAcceptanceAdminService.getAcceptanceById(req.params.id);
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

export const legalExternalAcceptanceAdminRouter = router;
