import { OnboardingStatus, UserRole } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import type { PortalType } from "../types";
import { advanceOnboardingStatusFromFlags } from "../../onboarding/utils/advance-onboarding-status";

/**
 * When a webhook indicates AML screening cleared for the main onboarding entity:
 * set aml_approved when allowed, then apply flag-driven onboarding_status via advanceOnboardingStatusFromFlags.
 */
export async function maybeAdvanceOrgAfterAmlScreeningCleared(params: {
  organizationId: string;
  portalType: PortalType;
  userId: string;
  organizationName?: string | null;
  trigger: string;
  extraMetadata?: Record<string, unknown>;
}): Promise<void> {
  const { organizationId, portalType, userId, organizationName, trigger, extraMetadata } = params;
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
    logger.warn({ organizationId, trigger }, "[AML milestone webhook] Organization not found; skip org advance");
    return;
  }

  if (org.onboarding_status === OnboardingStatus.PENDING_FINAL_APPROVAL && org.aml_approved) {
    logger.info(
      { organizationId, trigger },
      "[AML milestone webhook] Idempotent no-op: already PENDING_FINAL_APPROVAL with aml_approved"
    );
    return;
  }

  if (org.onboarding_status !== OnboardingStatus.PENDING_AML) {
    logger.info(
      { organizationId, trigger, onboardingStatus: org.onboarding_status },
      "[AML milestone webhook] Skipping org AML advance — onboarding_status is not PENDING_AML"
    );
    return;
  }

  let setAmlFlag = false;
  if (!org.aml_approved) {
    if (isInvestor) {
      await prisma.investorOrganization.update({
        where: { id: organizationId },
        data: { aml_approved: true },
      });
    } else {
      await prisma.issuerOrganization.update({
        where: { id: organizationId },
        data: { aml_approved: true },
      });
    }
    setAmlFlag = true;
    logger.info({ organizationId, trigger }, "[AML milestone webhook] Set aml_approved from AML screening webhook");
  }

  await advanceOnboardingStatusFromFlags({
    organizationId,
    portalType: portalType as "investor" | "issuer",
    reason: trigger,
  });

  const after = isInvestor
    ? await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true },
      })
    : await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: { onboarding_status: true },
      });

  if (setAmlFlag) {
    try {
      await prisma.onboardingLog.create({
        data: {
          user_id: userId,
          event_type: "ONBOARDING_STATUS_UPDATED",
          role: isInvestor ? UserRole.INVESTOR : UserRole.ISSUER,
          portal: portalType,
          organization_name: organizationName ?? org.name ?? undefined,
          investor_organization_id: isInvestor ? organizationId : undefined,
          issuer_organization_id: isInvestor ? undefined : organizationId,
          metadata: {
            organizationId,
            trigger,
            previousStatus: OnboardingStatus.PENDING_AML,
            newStatus: after?.onboarding_status,
            amlApproved: true,
            ...extraMetadata,
          },
        },
      });
    } catch (e) {
      logger.error(
        { error: e instanceof Error ? e.message : String(e), organizationId, trigger },
        "[AML milestone webhook] Failed to write onboarding log (non-blocking)"
      );
    }
  }

  logger.info(
    { organizationId, trigger, newStatus: after?.onboarding_status },
    "[AML milestone webhook] Applied aml flag and/or advance after AML screening cleared"
  );
}
