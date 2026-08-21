/**
 * DEMO ONLY — Contract ARF-i Letter of Offer merge preview.
 * Not wired to Send Offer or SigningCloud. Wet-ink signatures remain blank in the template.
 */

import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../../lib/prisma";
import { AppError } from "../../../lib/http/error-handler";
import {
  buildFacilityLoMergeData,
  normalizeContractFacilityLoMergeData,
} from "./build-facility-lo-merge-data";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import {
  facilityLoGenerateQuerySchema,
  facilityLoMergeBodySchema,
  facilityLoPrefillQuerySchema,
} from "./facility-lo-demo.schemas";
import { convertDocxToPdf, DocxToPdfError } from "./convert-docx-to-pdf";
import { renderFacilityLoDocx } from "./render-facility-lo-docx";

const router = Router();

function loDownloadBasename(issuerName: string): string {
  const safeName = (issuerName || "issuer").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return `ARF-LO-${safeName || "demo"}`;
}

/** GET /v1/admin/demos/contract-lo/fixture — default editable merge values */
router.get("/fixture", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: createFacilityLoFixture(),
    correlationId: res.locals.correlationId || "unknown",
  });
});

/**
 * GET /v1/admin/demos/contract-lo/prefill?contractId=
 * Prefill from platform contract + issuer org + originating/linked application.
 */
router.get("/prefill", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = facilityLoPrefillQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid query");
    }
    const { contractId } = parsed.data;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        issuer_organization: true,
        originating_application: true,
        applications: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Contract not found");
    }

    const application =
      contract.originating_application ?? contract.applications[0] ?? null;

    let gracePeriodDaysDefault: number | null = null;
    try {
      const settings = await prisma.platformFinanceSetting.findFirst({
        orderBy: { updated_at: "desc" },
      });
      if (settings && typeof settings.grace_period_days === "number") {
        gracePeriodDaysDefault = settings.grace_period_days;
      }
    } catch {
      // Platform finance settings table may be unavailable in some envs — ignore for demo
    }

    const data = buildFacilityLoMergeData({
      contract: {
        id: contract.id,
        issuer_organization_id: contract.issuer_organization_id,
        contract_details: contract.contract_details,
        offer_details: contract.offer_details,
        customer_details: contract.customer_details,
      },
      issuerOrganization: {
        id: contract.issuer_organization.id,
        name: contract.issuer_organization.name,
        registration_number: contract.issuer_organization.registration_number,
        address: contract.issuer_organization.address,
        corporate_onboarding_data: contract.issuer_organization.corporate_onboarding_data,
      },
      application: application
        ? {
            id: application.id,
            company_details: application.company_details,
            business_details: application.business_details,
          }
        : null,
      gracePeriodDaysDefault,
    });

    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId || "unknown",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/admin/demos/contract-lo/generate?format=docx|pdf
 * Body: ContractFacilityLoMergeData → download filled .docx or Gotenberg-converted .pdf
 */
router.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = facilityLoGenerateQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(400, "VALIDATION_ERROR", "format must be docx or pdf");
    }
    const parsed = facilityLoMergeBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid merge payload");
    }
    const data = normalizeContractFacilityLoMergeData(parsed.data);
    const docxBuffer = renderFacilityLoDocx(data);
    const basename = loDownloadBasename(data.issuer_name);

    if (query.data.format === "pdf") {
      try {
        const pdfBuffer = await convertDocxToPdf(docxBuffer);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${basename}.pdf"`);
        res.send(pdfBuffer);
        return;
      } catch (err) {
        if (err instanceof DocxToPdfError) {
          const status =
            err.code === "GOTENBERG_MISSING" || err.code === "GOTENBERG_UNAVAILABLE" ? 503 : 500;
          throw new AppError(status, err.code, err.message);
        }
        throw err;
      }
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${basename}.docx"`);
    res.send(docxBuffer);
  } catch (err) {
    next(err);
  }
});

export const facilityLoDemoRouter = router;
