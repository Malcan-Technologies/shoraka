/**
 * Amendment flow logic: remarks, acknowledgements, resubmit.
 * Access checks are performed by the main ApplicationService before calling these methods.
 *
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow debugging (remarks, resubmit, acknowledge workflow)
 */

import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { applyContractCapacityChange } from "../../../lib/refresh-contract-facility";
import { ApplicationRepository } from "../repository";
import { assertRequiredSupportingDocumentsPresent } from "../supporting-docs-workflow";
import { buildApplicationRevisionSnapshot } from "../revision-snapshot";
import { summarizeResubmitSnapshotDiff } from "../../application-revision-diff";
import { Prisma } from "@prisma/client";
import { upsertLatestOrganizationFinancialStatementsFromApplication } from "../issuer-organization-financial-statements";
import {
  APPLICATION_AUDIT_TARGET_TYPE,
  issuerApplicationAuditContext,
  writeApplicationAuditLog,
} from "../audit/writer";
import type { AuditRequestContext } from "../../../lib/audit/context";

export interface AmendmentAllowedSections {
  allowedSections: Set<string>;
  allowedItemKeys: Set<string>;
}

/**
 * Load allowed sections from amendment remarks.
 * Only sections/items with REQUEST_AMENDMENT remarks can be updated.
 */
async function currentReviewCycle(applicationId: string): Promise<number> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { review_cycle: true },
  });
  return application?.review_cycle ?? 1;
}

export async function getAmendmentAllowedSections(
  applicationId: string
): Promise<AmendmentAllowedSections> {
  const reviewCycle = await currentReviewCycle(applicationId);
  const remarks = await prisma.applicationReviewRemark.findMany({
    where: {
      application_id: applicationId,
      review_cycle: reviewCycle,
      action_type: "REQUEST_AMENDMENT",
      submitted_at: { not: null },
    },
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

  // Final issuer step (replaces legacy review_and_submit): always PATCHable during amendment
  // so declaration checkboxes can be saved before resubmit even when no remark targets `declarations`.
  allowedSections.add("declarations");

  return { allowedSections, allowedItemKeys };
}

/**
 * Load amendment remarks for an application.
 */
export async function loadAmendmentRemarks(applicationId: string) {
  const reviewCycle = await currentReviewCycle(applicationId);
  return prisma.applicationReviewRemark.findMany({
    where: {
      application_id: applicationId,
      review_cycle: reviewCycle,
      action_type: "REQUEST_AMENDMENT",
      submitted_at: { not: null },
    },
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
  repository: ApplicationRepository,
  auditContext: AuditRequestContext
) {
  const application = await repository.findById(applicationId);
  if (!application) {
    throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }

  const existing: string[] = [];
  const raw = (application as { amendment_acknowledged_workflow_ids?: unknown }).amendment_acknowledged_workflow_ids;
  if (Array.isArray(raw)) {
    existing.push(...raw.filter((id): id is string => typeof id === "string"));
  }

  if (existing.includes(workflowId)) {
    return application;
  }

  const reviewCycle = (application as { review_cycle?: number }).review_cycle ?? 1;
  const nextIds = [...existing, workflowId];

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        amendment_acknowledged_workflow_ids: nextIds,
        updated_at: new Date(),
      },
    });

    await writeApplicationAuditLog(
      {
        eventType: "APPLICATION_AMENDMENT_ACKNOWLEDGED",
        context: auditContext,
        applicationId,
        targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
        targetId: applicationId,
        metadata: { workflowId, reviewCycle },
      },
      tx
    );

    return updated;
  });
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
  repository: ApplicationRepository,
  auditContext: AuditRequestContext = issuerApplicationAuditContext(userId)
) {
  const application = await repository.findById(applicationId);
  if (!application) {
    throw new AppError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }
  if ((application as any).status !== "AMENDMENT_REQUESTED") {
    throw new AppError(400, "INVALID_STATE", "Resubmit allowed only in AMENDMENT_REQUESTED state");
  }

  const previousCycle = (application as { review_cycle?: number }).review_cycle ?? 1;
  const newCycle = previousCycle + 1;

  const remarks = await prisma.applicationReviewRemark.findMany({
    where: {
      application_id: applicationId,
      review_cycle: previousCycle,
      action_type: "REQUEST_AMENDMENT",
      submitted_at: { not: null },
    },
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
  let resubmitProductWorkflow: Prisma.JsonValue | undefined;
  if (resubmitProductId) {
    const resubmitProduct = await prisma.product.findUnique({ where: { id: resubmitProductId } });
    if (resubmitProduct?.workflow) {
      assertRequiredSupportingDocumentsPresent(
        resubmitProduct.workflow as unknown[],
        application.supporting_documents
      );
      resubmitProductWorkflow = resubmitProduct.workflow as Prisma.JsonValue;
    }
  }

  const appFullCurrent = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      contract: true,
      invoices: true,
      issuer_organization: true,
      application_guarantors: { orderBy: { position: "asc" } },
    },
  });

  const prevRevision = await prisma.applicationRevision.findFirst({
    where: { application_id: applicationId, review_cycle: previousCycle },
  });

  const nextSnapshot = appFullCurrent
    ? buildApplicationRevisionSnapshot({
        financing_type: appFullCurrent.financing_type,
        product_version: appFullCurrent.product_version,
        product_workflow: resubmitProductWorkflow ?? null,
        amendment_acknowledged_workflow_ids: appFullCurrent.amendment_acknowledged_workflow_ids,
        financing_structure: appFullCurrent.financing_structure,
        company_details: appFullCurrent.company_details,
        business_details: appFullCurrent.business_details,
        application_guarantors: appFullCurrent.application_guarantors,
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

  let createdRevisionId: string | null = null;
  const resubmitContractId = appFullCurrent?.contract_id ?? null;

  const persistResubmit = async (tx: Prisma.TransactionClient) => {
    await tx.applicationReviewRemark.deleteMany({
      where: {
        application_id: applicationId,
        review_cycle: previousCycle,
        submitted_at: null,
      },
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
      const created = await (tx as any).applicationRevision.create({
        data: {
          application_id: applicationId,
          review_cycle: newCycle,
          snapshot: nextSnapshot,
          submitted_at: new Date(),
        },
      });

      createdRevisionId = created?.id ?? null;
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

    await writeApplicationAuditLog(
      {
        eventType: "APPLICATION_RESUBMITTED",
        context: auditContext,
        applicationId,
        targetType: APPLICATION_AUDIT_TARGET_TYPE.APPLICATION,
        targetId: applicationId,
        metadata: {
          revisionId: createdRevisionId,
          revisionNumber: newCycle,
          ...(resubmitChangeSummary
            ? {
                changedSections: resubmitChangeSummary.changedSectionKeys,
                activitySummary: resubmitChangeSummary.activitySummary,
              }
            : {}),
          reviewCycle: newCycle,
        },
      },
      tx
    );
  };

  if (resubmitContractId) {
    await applyContractCapacityChange(resubmitContractId, prisma, persistResubmit, {
      assertWrite: true,
    });
  } else {
    await prisma.$transaction(persistResubmit);
  }

  logger.info({ applicationId }, "Application resubmitted: cleared amendment flags, created revision");

  await upsertLatestOrganizationFinancialStatementsFromApplication({
    applicationId,
    sourceApplicationRevisionId: createdRevisionId,
  });

  const updatedApplication = await repository.findById(applicationId);
  return updatedApplication!;
}
