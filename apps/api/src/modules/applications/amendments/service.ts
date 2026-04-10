/**
 * Amendment flow logic: remarks, acknowledgements, resubmit.
 * Access checks are performed by the main ApplicationService before calling these methods.
 *
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow debugging (remarks, resubmit, acknowledge workflow)
 */

import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { ApplicationRepository } from "../repository";
import { assertRequiredSupportingDocumentsPresent } from "../supporting-docs-workflow";
import { buildApplicationRevisionSnapshot } from "../revision-snapshot";
import { summarizeResubmitSnapshotDiff } from "../../application-revision-diff";

export interface AmendmentAllowedSections {
  allowedSections: Set<string>;
  allowedItemKeys: Set<string>;
}

/**
 * Load allowed sections from amendment remarks.
 * Only sections/items with REQUEST_AMENDMENT remarks can be updated.
 */
export async function getAmendmentAllowedSections(
  applicationId: string
): Promise<AmendmentAllowedSections> {
  const remarks = await prisma.applicationReviewRemark.findMany({
    where: {
      application_id: applicationId,
      action_type: "REQUEST_AMENDMENT",
      submitted_at: { not: null },
    } as any,
  });

  const allowedSections = new Set<string>();
  const allowedItemKeys = new Set<string>();

  for (const r of remarks) {
    if (r.scope === "section" && r.scope_key) {
      allowedSections.add(r.scope_key);
      if (r.scope_key === "financial") allowedSections.add("financial_statements");
    } else if (r.scope === "item" && r.scope_key) {
      const stepKey = r.scope_key.split(":")[0];
      allowedSections.add(stepKey);
      allowedItemKeys.add(r.scope_key);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug("[AMENDMENT GUARD]", "allowedSections:", Array.from(allowedSections));
  }

  return { allowedSections, allowedItemKeys };
}

/**
 * Load amendment remarks for an application.
 */
export async function loadAmendmentRemarks(applicationId: string) {
  return prisma.applicationReviewRemark.findMany({
    where: {
      application_id: applicationId,
      action_type: "REQUEST_AMENDMENT",
      submitted_at: { not: null },
    } as any,
    orderBy: { created_at: "asc" },
  });
}

/**
 * Acknowledge a workflowId during amendment mode.
 * Appends workflowId to application's amendment_acknowledged_workflow_ids if missing.
 */
export async function acknowledgeWorkflow(
  applicationId: string,
  workflowId: string,
  repository: ApplicationRepository
) {
  const existing: string[] = [] as string[];
  const application = await repository.findById(applicationId);
  if (application) {
    const raw = (application as any).amendment_acknowledged_workflow_ids;
    if (Array.isArray(raw)) existing.push(...raw);
  }

  const deduped = new Set(existing);
  deduped.add(workflowId);

  return repository.update(applicationId, {
    amendment_acknowledged_workflow_ids: Array.from(deduped),
    updated_at: new Date(),
  } as any);
}

/**
 * Resubmit an application after amendments are acknowledged.
 * 1. Delete only REQUEST_AMENDMENT review records
 * 2. Create application revision snapshot
 * 3. Set status to RESUBMITTED
 */
export async function resubmitApplication(
  applicationId: string,
  userId: string,
  repository: ApplicationRepository
) {
  const application = await repository.findById(applicationId);
  if (!application) {
    throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }
  if ((application as any).status !== "AMENDMENT_REQUESTED") {
    throw new AppError(400, "INVALID_STATE", "Resubmit allowed only in AMENDMENT_REQUESTED state");
  }

  const remarks = await prisma.applicationReviewRemark.findMany({
    where: {
      application_id: applicationId,
      action_type: "REQUEST_AMENDMENT",
      submitted_at: { not: null },
    } as any,
  });

  const requiredSectionKeys = new Set<string>();
  for (const r of remarks) {
    if (r.scope === "section" && r.scope_key) {
      requiredSectionKeys.add(r.scope_key);
    } else if (r.scope === "item" && r.scope_key) {
      requiredSectionKeys.add(r.scope_key.split(":")[0]);
    }
  }

  const acknowledgedRaw: string[] =
    ((application as any).amendment_acknowledged_workflow_ids as string[]) ?? [];
  const acknowledgedStepKeys = new Set(acknowledgedRaw.map((id) => id.replace(/_\d+$/, "")));

  const missing: string[] = [];
  for (const req of requiredSectionKeys) {
    if (req.startsWith("financial")) continue;
    if (!acknowledgedStepKeys.has(req)) missing.push(req);
  }
  if (missing.length > 0) {
    throw new AppError(
      400,
      "MISSING_ACKNOWLEDGEMENTS",
      "All amendments must be acknowledged before resubmitting."
    );
  }

  const financingTypeResubmit = application.financing_type as { product_id?: string } | null | undefined;
  const resubmitProductId = financingTypeResubmit?.product_id;
  if (resubmitProductId) {
    const resubmitProduct = await prisma.product.findUnique({ where: { id: resubmitProductId } });
    if (resubmitProduct?.workflow) {
      assertRequiredSupportingDocumentsPresent(
        resubmitProduct.workflow as unknown[],
        application.supporting_documents
      );
    }
  }

  const appFullCurrent = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { contract: true, invoices: true, issuer_organization: true },
  });

  const previousCycle = (application as any).review_cycle ?? 1;
  const newCycle = previousCycle + 1;

  const prevRevision = await prisma.applicationRevision.findFirst({
    where: { application_id: applicationId, review_cycle: previousCycle },
  });

  const nextSnapshot = appFullCurrent
    ? buildApplicationRevisionSnapshot({
        financing_type: appFullCurrent.financing_type,
        product_version: appFullCurrent.product_version,
        amendment_acknowledged_workflow_ids: appFullCurrent.amendment_acknowledged_workflow_ids,
        financing_structure: appFullCurrent.financing_structure,
        company_details: appFullCurrent.company_details,
        business_details: appFullCurrent.business_details,
        financial_statements: appFullCurrent.financial_statements,
        supporting_documents: appFullCurrent.supporting_documents,
        declarations: appFullCurrent.declarations,
        review_and_submit: appFullCurrent.review_and_submit,
        last_completed_step: appFullCurrent.last_completed_step,
        contract_id: appFullCurrent.contract_id,
        contract: appFullCurrent.contract,
        invoices: appFullCurrent.invoices,
        issuer_organization: appFullCurrent.issuer_organization,
      })
    : null;

  const resubmitChangeSummary =
    prevRevision?.snapshot && nextSnapshot
      ? summarizeResubmitSnapshotDiff(prevRevision.snapshot, nextSnapshot)
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.applicationReviewRemark.deleteMany({
      where: {
        application_id: applicationId,
        action_type: "REQUEST_AMENDMENT",
      } as any,
    });

    await tx.applicationReviewItem.deleteMany({
      where: {
        application_id: applicationId,
        status: "AMENDMENT_REQUESTED",
      } as any,
    });

    await tx.applicationReview.deleteMany({
      where: {
        application_id: applicationId,
        status: "AMENDMENT_REQUESTED",
      } as any,
    });

    if (appFullCurrent && nextSnapshot) {
      await (tx as any).applicationRevision.create({
        data: {
          application_id: applicationId,
          review_cycle: newCycle,
          snapshot: nextSnapshot,
          submitted_at: new Date(),
        },
      });
    }

    await tx.application.update({
      where: { id: applicationId },
      data: ({
        review_cycle: newCycle,
        amendment_acknowledged_workflow_ids: [],
        status: "RESUBMITTED",
        updated_at: new Date(),
      } as any),
    });
  });

  logger.info({ applicationId }, "Application resubmitted: cleared amendment flags, created revision");

  const logMetadata: Record<string, unknown> = {
    portal: "ISSUER",
  };
  if (resubmitChangeSummary) {
    logMetadata.resubmit_changes = {
      section_keys: resubmitChangeSummary.changedSectionKeys,
      section_labels: resubmitChangeSummary.changedSectionLabels,
      contract_updated: resubmitChangeSummary.contractChanged,
      invoices_updated: resubmitChangeSummary.invoicesChanged,
      activity_summary: resubmitChangeSummary.activitySummary,
      field_changes: resubmitChangeSummary.field_changes,
    };
  }

  await prisma.applicationLog.create({
    data: {
      user_id: userId,
      application_id: applicationId,
      event_type: "APPLICATION_RESUBMITTED",
      review_cycle: newCycle,
      portal: "ISSUER",
      metadata: logMetadata,
      created_at: new Date(),
    } as any,
  });

  const updatedApplication = await repository.findById(applicationId);
  return updatedApplication!;
}
