/**
 * SECTION: Required Application Review sections and their effective approval
 * WHY: Admin review and Note creation must agree on which sections are required
 * and when each one counts as approved
 */

import type { ApplicationStatus, Prisma, PrismaClient } from "@prisma/client";
import {
  REVIEW_SECTION_ORDER,
  getReviewSectionOrder,
  getReviewSectionPrerequisites,
  getStepKeyFromStepId,
  isFacilityOnlyNewContract,
  resolveEffectiveReviewSectionStatus,
  shouldShowAcceptanceDocumentsReviewSection,
  workflowShowsAcceptanceReviewSection,
  type ReviewSection,
} from "@cashsouk/types";
import { ProductRepository } from "../products/repository";

type ReviewSectionReader = PrismaClient | Prisma.TransactionClient;

type ProductVersionReader = Pick<ProductRepository, "findById" | "findByBaseAndVersion">;

export type ReviewSectionPolicy = {
  /** Must be APPROVED before the application is fully reviewed. */
  requiredSections: Set<ReviewSection>;
  /** Sections shown in the Admin review tabs. */
  visibleSections: Set<ReviewSection>;
  /** Lock dependencies for each section. */
  prerequisitesBySection: Partial<Record<ReviewSection, ReviewSection[]>>;
  /** Frozen product.workflow for application.product_version (null when unresolved). */
  productWorkflow: unknown[] | null;
};

const WORKFLOW_REVIEW_SECTION_KEYS: ReadonlySet<string> = new Set(
  REVIEW_SECTION_ORDER.filter((section) => section !== "financial")
);

function structureTypeOf(financingStructure: unknown): string | undefined {
  return financingStructure && typeof financingStructure === "object"
    ? ((financingStructure as Record<string, unknown>).structure_type as string | undefined)
    : undefined;
}

/**
 * Build section policy for review UI and finalization checks.
 * Required sections come from the frozen product workflow; financial is always required.
 */
export async function resolveReviewSectionPolicy(
  application: {
    financing_type?: unknown;
    financing_structure?: unknown;
    product_version?: number | null;
  },
  productRepository: ProductVersionReader
): Promise<ReviewSectionPolicy> {
  const requiredSections = new Set<ReviewSection>(["financial"]);
  const financingType =
    application.financing_type && typeof application.financing_type === "object"
      ? (application.financing_type as Record<string, unknown>)
      : null;
  const productId = typeof financingType?.product_id === "string" ? financingType.product_id : null;

  const structureType = structureTypeOf(application.financing_structure);
  const prerequisitesBySection = getReviewSectionPrerequisites(structureType);
  const sectionOrder = getReviewSectionOrder(structureType);

  if (!productId) {
    const fallback = new Set(sectionOrder);
    if (
      isFacilityOnlyNewContract({
        structureType,
        financingType: application.financing_type,
      })
    ) {
      fallback.delete("invoice_details");
    }
    return {
      requiredSections: fallback,
      visibleSections: new Set(fallback),
      prerequisitesBySection,
      productWorkflow: null,
    };
  }

  // Use frozen application.product_version so Acceptance visibility matches issuer + sync.
  const product =
    application.product_version != null
      ? await productRepository.findByBaseAndVersion(productId, application.product_version)
      : await productRepository.findById(productId);
  if (!product) {
    const fallback = new Set(sectionOrder);
    if (
      isFacilityOnlyNewContract({
        structureType,
        financingType: application.financing_type,
      })
    ) {
      fallback.delete("invoice_details");
    }
    return {
      requiredSections: fallback,
      visibleSections: new Set(fallback),
      prerequisitesBySection,
      productWorkflow: null,
    };
  }

  const workflow = Array.isArray(product.workflow) ? product.workflow : [];
  for (const rawStep of workflow) {
    const step = rawStep as { id?: unknown };
    const stepId = typeof step.id === "string" ? step.id : "";
    if (!stepId) continue;
    const stepKey = getStepKeyFromStepId(stepId);
    if (!stepKey) continue;
    if (stepKey === "financial_statements") {
      requiredSections.add("financial");
      continue;
    }
    if (!WORKFLOW_REVIEW_SECTION_KEYS.has(stepKey)) continue;
    requiredSections.add(stepKey as ReviewSection);
  }

  if (
    isFacilityOnlyNewContract({
      structureType,
      financingType: application.financing_type,
    })
  ) {
    requiredSections.delete("invoice_details");
  }

  const visibleSections = new Set(requiredSections);
  if (
    shouldShowAcceptanceDocumentsReviewSection(
      structureType,
      workflowShowsAcceptanceReviewSection(workflow)
    )
  ) {
    visibleSections.add("acceptance_documents");
  }
  return {
    requiredSections,
    visibleSections,
    prerequisitesBySection,
    productWorkflow: workflow,
  };
}

/** Required sections whose effective status is not APPROVED, in review tab order. */
export function listUnapprovedRequiredReviewSections(input: {
  requiredSections: ReadonlySet<ReviewSection>;
  financingStructure: unknown;
  applicationReviews: ReadonlyArray<{ section: string; status: string }>;
}): ReviewSection[] {
  const structureType = structureTypeOf(input.financingStructure);
  const statusBySection = new Map(input.applicationReviews.map((row) => [row.section, row.status]));
  return getReviewSectionOrder(structureType).filter(
    (section) =>
      input.requiredSections.has(section) &&
      resolveEffectiveReviewSectionStatus({
        section,
        structureType,
        reviewStatus: statusBySection.get(section),
      }) !== "APPROVED"
  );
}

/**
 * Current application status and the required review sections that are not yet approved.
 * Returns null when the application does not exist.
 */
export async function loadApplicationReviewApproval(
  db: ReviewSectionReader,
  applicationId: string,
  productRepository: ProductVersionReader = new ProductRepository()
): Promise<{ status: ApplicationStatus; unapprovedRequiredSections: ReviewSection[] } | null> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      financing_type: true,
      financing_structure: true,
      product_version: true,
      // Bounded: application_reviews is unique per (application_id, section).
      application_reviews: { select: { section: true, status: true } },
    },
  });
  if (!application) return null;

  const policy = await resolveReviewSectionPolicy(application, productRepository);
  return {
    status: application.status,
    unapprovedRequiredSections: listUnapprovedRequiredReviewSections({
      requiredSections: policy.requiredSections,
      financingStructure: application.financing_structure,
      applicationReviews: application.application_reviews,
    }),
  };
}
