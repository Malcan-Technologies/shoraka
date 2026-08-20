import { OnboardingStatus, OrganizationType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";
import { writeOnboardingAuditLog } from "../../onboarding/audit/writer";
import { ONBOARDING_AUDIT_TARGET_TYPE } from "../../onboarding/audit/events";
import { advanceOnboardingStatusFromFlags } from "../../onboarding/utils/advance-onboarding-status";
import {
  claimLandPendingApproval,
  claimLandPendingSsmReview,
  claimOnboardingApproved,
} from "../../onboarding/utils/onboarding-transition-claims";
import { decideIndividualApprovedOutcome } from "./individual-onboarding-transition";
import { getCompanyApprovedSsmLandingUpdate } from "./company-approved-ssm-landing";
import {
  AUDIT_PORTAL,
  auditPortalFromLegacy,
  organizationKindFromPortalType,
  webhookAuditContext,
} from "../../../lib/audit/context";
import type { PortalType } from "../types";

type ApprovedMilestoneOnboarding = {
  id: string;
  user_id: string;
};

async function writeStatusChanged(params: {
  onboarding: ApprovedMilestoneOnboarding;
  organizationId: string;
  portalType: PortalType;
  organizationType: OrganizationType;
  previousStatus: OnboardingStatus;
  newStatus: OnboardingStatus;
  db: Parameters<typeof writeOnboardingAuditLog>[1];
}): Promise<void> {
  await writeOnboardingAuditLog(
    {
      eventType: "ONBOARDING_STATUS_CHANGED",
      context: webhookAuditContext({
        portal: auditPortalFromLegacy(params.portalType),
      }),
      subjectUserId: params.onboarding.user_id,
      onboardingId: params.onboarding.id,
      organizationId: params.organizationId,
      organizationKind: organizationKindFromPortalType(params.portalType),
      organizationType: params.organizationType,
      targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
      targetId: params.organizationId,
      metadata: {
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        trigger: "REGTANK_APPROVED",
      },
    },
    params.db
  );
}

async function writeOnboardingApproved(params: {
  onboarding: ApprovedMilestoneOnboarding;
  organizationId: string;
  portalType: PortalType;
  organizationType: OrganizationType;
  previousStatus: OnboardingStatus;
  newStatus: OnboardingStatus | undefined;
  trigger: string;
  db: Parameters<typeof writeOnboardingAuditLog>[1];
}): Promise<void> {
  await writeOnboardingAuditLog(
    {
      eventType: "ONBOARDING_APPROVED",
      context: webhookAuditContext({
        portal: params.portalType === "investor" ? AUDIT_PORTAL.INVESTOR : AUDIT_PORTAL.ISSUER,
      }),
      subjectUserId: params.onboarding.user_id,
      onboardingId: params.onboarding.id,
      organizationId: params.organizationId,
      organizationKind: organizationKindFromPortalType(params.portalType),
      organizationType: params.organizationType,
      targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
      targetId: params.organizationId,
      metadata: {
        previousApproved: false,
        newApproved: true,
        previousStatus: params.previousStatus,
        newStatus: params.newStatus,
        trigger: params.trigger,
      },
    },
    params.db
  );
}

/**
 * Apply a RegTank APPROVED webhook to organization onboarding_status / onboarding_approved.
 * Never regresses later or terminal stages. Writes ONBOARDING_STATUS_CHANGED /
 * ONBOARDING_APPROVED only when the corresponding SOT claim wins.
 */
export async function applyApprovedOrganizationMilestone(params: {
  organizationId: string;
  portalType: PortalType;
  onboarding: ApprovedMilestoneOnboarding;
}): Promise<void> {
  const { organizationId, portalType, onboarding } = params;
  const isInvestor = portalType === "investor";

  const org = isInvestor
    ? await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: {
          onboarding_status: true,
          onboarding_approved: true,
          type: true,
        },
      })
    : await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: {
          onboarding_status: true,
          onboarding_approved: true,
          type: true,
        },
      });

  if (!org) {
    logger.warn({ organizationId, portalType }, "Organization not found, skipping APPROVED milestone");
    return;
  }

  const previousStatus = org.onboarding_status;
  const usesSsmLanding = !isInvestor || org.type === OrganizationType.COMPANY;

  if (usesSsmLanding) {
    const landing = getCompanyApprovedSsmLandingUpdate({
      currentOnboardingStatus: previousStatus,
    });
    if (!landing) {
      logger.info(
        {
          organizationId,
          portalType,
          orgType: org.type,
          onboardingStatus: previousStatus,
        },
        "[APPROVED] Idempotent no-op — company/issuer already at or past SSM review (no regression)"
      );
      return;
    }

    await prisma.$transaction(async (tx) => {
      const claimed = await claimLandPendingSsmReview({
        organizationId,
        portalType,
        db: tx,
      });
      if (!claimed) return;
      await writeStatusChanged({
        onboarding,
        organizationId,
        portalType,
        organizationType: org.type,
        previousStatus,
        newStatus: OnboardingStatus.PENDING_SSM_REVIEW,
        db: tx,
      });
    });
    return;
  }

  const outcome = decideIndividualApprovedOutcome({
    currentOnboardingStatus: org.onboarding_status,
    onboardingApproved: org.onboarding_approved,
  });

  if (outcome === "heal-to-pending-approval") {
    await prisma.$transaction(async (tx) => {
      const claimed = await claimLandPendingApproval({
        organizationId,
        portalType,
        resetCompanySsmGate: true,
        db: tx,
      });
      if (!claimed) return;
      await writeStatusChanged({
        onboarding,
        organizationId,
        portalType,
        organizationType: org.type,
        previousStatus,
        newStatus: OnboardingStatus.PENDING_APPROVAL,
        db: tx,
      });
    });
    logger.info(
      { organizationId, portalType, orgType: org.type, nextOrgStatus: OnboardingStatus.PENDING_APPROVAL },
      "Healed personal organization to PENDING_APPROVAL after RegTank APPROVED"
    );
    return;
  }

  if (outcome === "set-approved-and-advance") {
    await prisma.$transaction(async (tx) => {
      const claimed = await claimOnboardingApproved({
        organizationId,
        portalType,
        db: tx,
      });
      if (!claimed) {
        await advanceOnboardingStatusFromFlags({
          organizationId,
          portalType,
          reason: "REGTANK_INDIVIDUAL_APPROVED",
          db: tx,
        });
        return;
      }
      await advanceOnboardingStatusFromFlags({
        organizationId,
        portalType,
        reason: "REGTANK_INDIVIDUAL_APPROVED",
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
      await writeOnboardingApproved({
        onboarding,
        organizationId,
        portalType,
        organizationType: org.type,
        previousStatus,
        newStatus: after?.onboarding_status,
        trigger: "REGTANK_INDIVIDUAL_APPROVED",
        db: tx,
      });
    });
    logger.info(
      { organizationId, portalType },
      "Set onboarding_approved and applied advance after RegTank APPROVED (personal investor)"
    );
    return;
  }

  await advanceOnboardingStatusFromFlags({
    organizationId,
    portalType,
    reason: "REGTANK_INDIVIDUAL_APPROVED",
  });
  logger.info(
    {
      organizationId,
      onboardingStatus: org.onboarding_status,
      onboardingApproved: org.onboarding_approved,
    },
    "[Individual APPROVED] Idempotent no-op — ran shared advance only (org already approved, progressed, or terminal)"
  );
}
