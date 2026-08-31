import { OnboardingStatus, UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import type { PortalType } from "../types";
import { advanceOnboardingStatusFromFlags } from "../../onboarding/utils/advance-onboarding-status";
import { getRegTankAPIClient } from "../api-client";
import { createOnboardingLogRow, webhookAuditContext } from "../../../lib/audit";
import type { AuditRequestContext } from "../../../lib/audit";

/**
 * Result of an AML milestone check/apply attempt.
 * `rawStatus`/`approved` are only meaningful for the live-query variants below;
 * for the webhook-driven `maybeAdvanceOrgAfterAmlScreeningCleared` the caller has
 * already confirmed approval before invoking it, so `approved` is always true there.
 */
export interface AmlMilestoneOutcome {
  organizationFound: boolean;
  rawStatus: string | null;
  approved: boolean;
  amlApproved: boolean;
  onboardingStatus: OnboardingStatus | null;
  advanced: boolean;
}

async function readCurrentOrgState(
  organizationId: string,
  portalType: PortalType
): Promise<{ found: boolean; amlApproved: boolean; onboardingStatus: OnboardingStatus | null }> {
  const isInvestor = portalType === "investor";
  const org = isInvestor
    ? await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true, aml_approved: true },
      })
    : await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true, aml_approved: true },
      });

  if (!org) return { found: false, amlApproved: false, onboardingStatus: null };
  return { found: true, amlApproved: org.aml_approved, onboardingStatus: org.onboarding_status };
}

/**
 * When an AML/KYC/KYB result is already confirmed approved (by the caller) for the
 * main onboarding entity: set `aml_approved` (idempotent) then apply flag-driven
 * `onboarding_status` advancement via `advanceOnboardingStatusFromFlags`.
 *
 * Sequencing is entirely delegated to `advanceOnboardingStatusFromFlags`, which only
 * advances `PENDING_AML` -> `PENDING_FINAL_APPROVAL`. Writing `aml_approved` here does
 * NOT skip earlier stages: if the organization is not yet at `PENDING_AML` (e.g. still
 * awaiting onboarding approval), the flag is safely recorded now and will be picked up
 * automatically the next time `advanceOnboardingStatusFromFlags` runs for this org
 * (already invoked after every onboarding-approval transition).
 */
export async function maybeAdvanceOrgAfterAmlScreeningCleared(params: {
  organizationId: string;
  portalType: PortalType;
  userId: string;
  organizationName?: string | null;
  trigger: string;
  extraMetadata?: Record<string, unknown>;
  context?: AuditRequestContext;
  actorUserId?: string | null;
}): Promise<AmlMilestoneOutcome> {
  const { organizationId, portalType, userId, organizationName, trigger, extraMetadata } = params;
  const auditContext = params.context ?? webhookAuditContext();
  const isInvestor = portalType === "investor";

  const org = isInvestor
    ? await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true, aml_approved: true, name: true },
      })
    : await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true, aml_approved: true, name: true },
      });

  if (!org) {
    logger.warn({ organizationId, trigger }, "[AML milestone] Organization not found; skip org advance");
    return {
      organizationFound: false,
      rawStatus: null,
      approved: true,
      amlApproved: false,
      onboardingStatus: null,
      advanced: false,
    };
  }

  const previousStatus = org.onboarding_status;

  // Never mutate organizations already in a terminal state — avoids touching unrelated
  // finished/rejected records when a late or out-of-order AML result arrives.
  if (previousStatus === OnboardingStatus.COMPLETED || previousStatus === OnboardingStatus.REJECTED) {
    logger.info(
      { organizationId, trigger, onboardingStatus: previousStatus },
      "[AML milestone] Skipping — organization already in a terminal state"
    );
    return {
      organizationFound: true,
      rawStatus: null,
      approved: true,
      amlApproved: org.aml_approved,
      onboardingStatus: previousStatus,
      advanced: false,
    };
  }

  if (previousStatus === OnboardingStatus.PENDING_FINAL_APPROVAL && org.aml_approved) {
    logger.info(
      { organizationId, trigger },
      "[AML milestone] Idempotent no-op: already PENDING_FINAL_APPROVAL with aml_approved"
    );
    return {
      organizationFound: true,
      rawStatus: null,
      approved: true,
      amlApproved: true,
      onboardingStatus: previousStatus,
      advanced: false,
    };
  }

  if (!org.aml_approved) {
    await prisma.$transaction(async (tx) => {
      if (isInvestor) {
        await tx.investorOrganization.update({
          where: { id: organizationId },
          data: { aml_approved: true },
        });
      } else {
        await tx.issuerOrganization.update({
          where: { id: organizationId },
          data: { aml_approved: true },
        });
      }

      await advanceOnboardingStatusFromFlags({
        organizationId,
        portalType: portalType as "investor" | "issuer",
        reason: trigger,
        db: tx,
      });

      const after = isInvestor
        ? await tx.investorOrganization.findUnique({
            where: { id: organizationId },
            select: { onboarding_status: true },
          })
        : await tx.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: { onboarding_status: true },
          });

      await createOnboardingLogRow(
        {
          userId: userId,
          eventType: "ONBOARDING_STATUS_UPDATED",
          role: isInvestor ? UserRole.INVESTOR : UserRole.ISSUER,
          portal: portalType,
          organizationName: organizationName ?? org.name ?? undefined,
          investorOrganizationId: isInvestor ? organizationId : undefined,
          issuerOrganizationId: isInvestor ? undefined : organizationId,
          metadata: {
            organizationId,
            trigger,
            previousStatus,
            newStatus: after?.onboarding_status,
            amlApproved: true,
            ...extraMetadata,
          },
          context: auditContext,
          actorUserId: params.actorUserId,
        },
        tx
      );
    });
    logger.info(
      { organizationId, trigger, onboardingStatus: previousStatus },
      "[AML milestone] Set aml_approved from confirmed RegTank approval"
    );
  } else {
    await advanceOnboardingStatusFromFlags({
      organizationId,
      portalType: portalType as "investor" | "issuer",
      reason: trigger,
    });
  }

  const after = isInvestor
    ? await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true },
      })
    : await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true },
      });

  logger.info(
    { organizationId, trigger, previousStatus, newStatus: after?.onboarding_status },
    "[AML milestone] Applied aml flag and/or advance after AML screening cleared"
  );

  return {
    organizationFound: true,
    rawStatus: null,
    approved: true,
    amlApproved: true,
    onboardingStatus: after?.onboarding_status ?? previousStatus,
    advanced: after?.onboarding_status !== previousStatus,
  };
}

function extractMainCompanyKybIdFromWebhookPayloads(webhookPayloads: unknown): string | null {
  if (!Array.isArray(webhookPayloads)) return null;
  for (const payload of webhookPayloads) {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const obj = payload as Record<string, unknown>;
      if (typeof obj.kybId === "string" && obj.kybId) return obj.kybId;
      const dto = obj.kybRequestDto;
      if (dto && typeof dto === "object" && !Array.isArray(dto)) {
        const id = (dto as Record<string, unknown>).kybId;
        if (typeof id === "string" && id) return id;
      }
      if (typeof obj.requestId === "string" && obj.requestId.startsWith("KYB")) return obj.requestId;
    }
  }
  return null;
}

/**
 * Resolve the main company's kybId for a COD requestId, then query RegTank live to
 * determine whether the exact documented/audited approval value ("Approved") has been
 * reached. `messageStatus: DONE`, `No Match`, `Risk Assessed`, `Unresolved`, or any other
 * value are intentionally NOT treated as approval here.
 */
async function checkMainCompanyKybApprovedLive(
  codRequestId: string
): Promise<{ approved: boolean; rawStatus: string | null }> {
  const apiClient = getRegTankAPIClient();
  let kybId: string | null = null;

  try {
    const codDetails = await apiClient.getCorporateOnboardingDetails(codRequestId);
    if (codDetails && typeof codDetails === "object" && !Array.isArray(codDetails)) {
      const dto = (codDetails as Record<string, unknown>).kybRequestDto;
      if (dto && typeof dto === "object" && !Array.isArray(dto)) {
        const id = (dto as Record<string, unknown>).kybId;
        if (typeof id === "string" && id) kybId = id;
      }
    }
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), codRequestId },
      "[AML milestone] Failed to fetch COD details while resolving main-company kybId"
    );
  }

  if (!kybId) {
    const onboarding = await prisma.regTankOnboarding.findUnique({
      where: { request_id: codRequestId },
      select: { webhook_payloads: true },
    });
    kybId = extractMainCompanyKybIdFromWebhookPayloads(onboarding?.webhook_payloads);
  }

  if (!kybId) {
    logger.info({ codRequestId }, "[AML milestone] No main-company kybId resolvable yet");
    return { approved: false, rawStatus: null };
  }

  try {
    const kybResponse = await apiClient.queryKYBStatus(kybId);
    const kybData = Array.isArray(kybResponse) ? kybResponse[0] : kybResponse;
    const rawStatus = typeof kybData?.status === "string" ? kybData.status : null;
    const approved = typeof rawStatus === "string" && rawStatus.toUpperCase() === "APPROVED";
    return { approved, rawStatus };
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), kybId, codRequestId },
      "[AML milestone] Failed to query live KYB status"
    );
    return { approved: false, rawStatus: null };
  }
}

/**
 * Company/corporate organizations: resolve the main company's live KYB status and, only
 * on an exact "Approved" result, apply the shared AML milestone. Safe no-op otherwise.
 */
export async function applyCorporateAmlMilestoneFromLiveKyb(params: {
  organizationId: string;
  portalType: PortalType;
  userId: string;
  organizationName?: string | null;
  codRequestId: string;
  trigger: string;
}): Promise<AmlMilestoneOutcome> {
  const { codRequestId, ...rest } = params;
  const { approved, rawStatus } = await checkMainCompanyKybApprovedLive(codRequestId);

  if (!approved) {
    const current = await readCurrentOrgState(rest.organizationId, rest.portalType);
    logger.info(
      { organizationId: rest.organizationId, trigger: rest.trigger, rawStatus },
      "[AML milestone] Live main-company KYB status is not an approval — no changes applied"
    );
    return {
      organizationFound: current.found,
      rawStatus,
      approved: false,
      amlApproved: current.amlApproved,
      onboardingStatus: current.onboardingStatus,
      advanced: false,
    };
  }

  const outcome = await maybeAdvanceOrgAfterAmlScreeningCleared({
    ...rest,
    extraMetadata: { codRequestId, rawStatus, source: "LIVE_KYB_QUERY" },
  });
  return { ...outcome, rawStatus, approved: true };
}

/**
 * Personal organizations: resolve the individual's live KYC status and, only on an
 * exact "Approved" result, apply the shared AML milestone. Safe no-op otherwise.
 */
export async function applyPersonalAmlMilestoneFromLiveKyc(params: {
  organizationId: string;
  portalType: PortalType;
  userId: string;
  organizationName?: string | null;
  kycId: string;
  trigger: string;
  context?: AuditRequestContext;
  actorUserId?: string | null;
}): Promise<AmlMilestoneOutcome> {
  const { kycId, ...rest } = params;
  const apiClient = getRegTankAPIClient();
  let rawStatus: string | null = null;

  try {
    const kycResponse = await apiClient.queryKYCStatus(kycId);
    const kycData = Array.isArray(kycResponse) ? kycResponse[0] : kycResponse;
    rawStatus = typeof kycData?.status === "string" ? kycData.status : null;
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error), kycId },
      "[AML milestone] Failed to query live KYC status"
    );
  }

  const approved = typeof rawStatus === "string" && rawStatus.toUpperCase() === "APPROVED";

  if (!approved) {
    const current = await readCurrentOrgState(rest.organizationId, rest.portalType);
    logger.info(
      { organizationId: rest.organizationId, trigger: rest.trigger, rawStatus },
      "[AML milestone] Live individual KYC status is not an approval — no changes applied"
    );
    return {
      organizationFound: current.found,
      rawStatus,
      approved: false,
      amlApproved: current.amlApproved,
      onboardingStatus: current.onboardingStatus,
      advanced: false,
    };
  }

  const outcome = await maybeAdvanceOrgAfterAmlScreeningCleared({
    ...rest,
    extraMetadata: { kycId, rawStatus, source: "LIVE_KYC_QUERY" },
  });
  return { ...outcome, rawStatus, approved: true };
}
