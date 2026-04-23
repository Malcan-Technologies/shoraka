import { OnboardingStatus, OrganizationType } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { logger } from "../../../lib/logger";

export type OnboardingPortalType = "investor" | "issuer";

/**
 * Moves org onboarding_status at most one step per loop iteration (max 2 iterations),
 * from flags only: PENDING_APPROVAL+onboarding_approved→PENDING_AML; PENDING_AML+aml_approved→PENDING_FINAL_APPROVAL.
 * Company PENDING_APPROVAL→PENDING_AML requires SSM gate (investor ssm_approved / issuer ssm_checked).
 */
export async function advanceOnboardingStatusFromFlags(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  reason: string;
}): Promise<{ changed: boolean }> {
  const { organizationId, portalType, reason } = params;
  let changed = false;

  for (let iteration = 0; iteration < 2; iteration++) {
    const org =
      portalType === "investor"
        ? await prisma.investorOrganization.findUnique({
            where: { id: organizationId },
            select: {
              onboarding_status: true,
              onboarding_approved: true,
              aml_approved: true,
              type: true,
              ssm_approved: true,
            },
          })
        : await prisma.issuerOrganization.findUnique({
            where: { id: organizationId },
            select: {
              onboarding_status: true,
              onboarding_approved: true,
              aml_approved: true,
              type: true,
              ssm_checked: true,
            },
          });

    if (!org) {
      logger.warn(
        { organizationId, portalType, reason },
        "[advanceOnboardingStatusFromFlags] Organization not found"
      );
      return { changed };
    }

    const st = org.onboarding_status;
    const oa = org.onboarding_approved;
    const aa = org.aml_approved;

    if (st === OnboardingStatus.PENDING_APPROVAL && oa) {
      if (org.type === OrganizationType.COMPANY) {
        const ssmOk =
          portalType === "investor"
            ? Boolean((org as { ssm_approved: boolean }).ssm_approved)
            : Boolean((org as { ssm_checked: boolean }).ssm_checked);
        if (!ssmOk) {
          logger.info(
            {
              organizationId,
              portalType,
              reason,
              iteration,
              onboardingStatus: st,
              msg: "Skipping advance — company SSM gate not satisfied for PENDING_APPROVAL to PENDING_AML",
            },
            "[advanceOnboardingStatusFromFlags]"
          );
          break;
        }
      }

      if (portalType === "investor") {
        await prisma.investorOrganization.update({
          where: { id: organizationId },
          data: { onboarding_status: OnboardingStatus.PENDING_AML },
        });
      } else {
        await prisma.issuerOrganization.update({
          where: { id: organizationId },
          data: { onboarding_status: OnboardingStatus.PENDING_AML },
        });
      }
      changed = true;
      logger.info(
        {
          msg: "Advancing onboarding_status",
          from: OnboardingStatus.PENDING_APPROVAL,
          to: OnboardingStatus.PENDING_AML,
          organizationId,
          portalType,
          reason,
          iteration,
        },
        "[advanceOnboardingStatusFromFlags]"
      );
      continue;
    }

    if (st === OnboardingStatus.PENDING_AML && aa) {
      if (portalType === "investor") {
        await prisma.investorOrganization.update({
          where: { id: organizationId },
          data: { onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL },
        });
      } else {
        await prisma.issuerOrganization.update({
          where: { id: organizationId },
          data: { onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL },
        });
      }
      changed = true;
      logger.info(
        {
          msg: "Advancing onboarding_status",
          from: OnboardingStatus.PENDING_AML,
          to: OnboardingStatus.PENDING_FINAL_APPROVAL,
          organizationId,
          portalType,
          reason,
          iteration,
        },
        "[advanceOnboardingStatusFromFlags]"
      );
      break;
    }

    logger.info(
      {
        organizationId,
        portalType,
        reason,
        iteration,
        onboardingStatus: st,
        onboardingApproved: oa,
        amlApproved: aa,
        msg: "Skipping advance — conditions not met",
      },
      "[advanceOnboardingStatusFromFlags]"
    );
    break;
  }

  return { changed };
}
