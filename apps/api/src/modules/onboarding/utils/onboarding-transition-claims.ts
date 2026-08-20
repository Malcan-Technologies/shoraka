import { OnboardingStatus, type Prisma, type PrismaClient } from "@prisma/client";
import type { OnboardingPortalType } from "./advance-onboarding-status";

type OrganizationDb = Prisma.TransactionClient | PrismaClient;

const PRE_PENDING_APPROVAL_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.PENDING,
  OnboardingStatus.IN_PROGRESS,
];

const COMPANY_SSM_LANDING_FROM: OnboardingStatus[] = [
  OnboardingStatus.PENDING,
  OnboardingStatus.IN_PROGRESS,
];

const REJECT_BLOCKED_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.REJECTED,
  OnboardingStatus.COMPLETED,
];

const AML_CLAIM_BLOCKED_STATUSES: OnboardingStatus[] = [
  OnboardingStatus.REJECTED,
  OnboardingStatus.COMPLETED,
];

export async function lockOrganizationRow(
  db: Prisma.TransactionClient,
  portalType: OnboardingPortalType,
  organizationId: string
): Promise<void> {
  if (portalType === "investor") {
    await db.$queryRaw`SELECT id FROM investor_organizations WHERE id = ${organizationId} FOR UPDATE`;
    return;
  }
  await db.$queryRaw`SELECT id FROM issuer_organizations WHERE id = ${organizationId} FOR UPDATE`;
}

async function updateManyOrg(
  db: Prisma.TransactionClient,
  portalType: OnboardingPortalType,
  organizationId: string,
  where: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<number> {
  const result =
    portalType === "investor"
      ? await db.investorOrganization.updateMany({
          where: { id: organizationId, ...where },
          data,
        })
      : await db.issuerOrganization.updateMany({
          where: { id: organizationId, ...where },
          data,
        });
  return result.count;
}

/**
 * First landing on PENDING_APPROVAL from PENDING/IN_PROGRESS only.
 * Already PENDING_APPROVAL (or later) is a no-op. Preserves the historical
 * side-effect of setting onboarding_approved on this landing.
 */
export async function claimLandPendingApproval(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  resetCompanySsmGate?: boolean;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const { organizationId, portalType, resetCompanySsmGate, db } = params;
  const data: Record<string, unknown> = {
    onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    onboarding_approved: true,
  };
  if (resetCompanySsmGate) {
    if (portalType === "investor") data.ssm_approved = false;
    else data.ssm_checked = false;
  }
  const count = await updateManyOrg(
    db,
    portalType,
    organizationId,
    { onboarding_status: { in: PRE_PENDING_APPROVAL_STATUSES } },
    data
  );
  return count === 1;
}

/**
 * First company/issuer landing on PENDING_SSM_REVIEW from PENDING/IN_PROGRESS only.
 * Later or terminal stages are not mutated.
 */
export async function claimLandPendingSsmReview(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    { onboarding_status: { in: COMPANY_SSM_LANDING_FROM } },
    { onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW }
  );
  return count === 1;
}

export async function claimOnboardingApproved(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    {
      onboarding_approved: false,
      onboarding_status: OnboardingStatus.PENDING_APPROVAL,
    },
    { onboarding_approved: true }
  );
  return count === 1;
}

export async function claimAmlApproved(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    {
      aml_approved: false,
      onboarding_status: { notIn: AML_CLAIM_BLOCKED_STATUSES },
    },
    { aml_approved: true }
  );
  return count === 1;
}

export async function claimOnboardingRejected(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    { onboarding_status: { notIn: REJECT_BLOCKED_STATUSES } },
    { onboarding_status: OnboardingStatus.REJECTED }
  );
  return count === 1;
}

export async function claimSsmApproved(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const data =
    params.portalType === "investor"
      ? {
          ssm_approved: true,
          onboarding_status: OnboardingStatus.PENDING_APPROVAL,
        }
      : {
          ssm_checked: true,
          onboarding_status: OnboardingStatus.PENDING_APPROVAL,
        };
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    { onboarding_status: OnboardingStatus.PENDING_SSM_REVIEW },
    data
  );
  return count === 1;
}

export async function claimFinalApprovalCompleted(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const now = new Date();
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    { onboarding_status: OnboardingStatus.PENDING_FINAL_APPROVAL },
    {
      onboarding_status: OnboardingStatus.COMPLETED,
      onboarded_at: now,
      admin_approved_at: now,
    }
  );
  return count === 1;
}

export async function claimLegacyOnboardingCompleted(params: {
  organizationId: string;
  portalType: OnboardingPortalType;
  db: Prisma.TransactionClient;
}): Promise<boolean> {
  const count = await updateManyOrg(
    params.db,
    params.portalType,
    params.organizationId,
    { onboarding_status: { not: OnboardingStatus.COMPLETED } },
    {
      onboarding_status: OnboardingStatus.COMPLETED,
      onboarded_at: new Date(),
    }
  );
  return count === 1;
}

export async function readOrganizationOnboardingState(
  db: OrganizationDb,
  portalType: OnboardingPortalType,
  organizationId: string
): Promise<{
  onboarding_status: OnboardingStatus;
  onboarding_approved: boolean;
  aml_approved: boolean;
} | null> {
  const org =
    portalType === "investor"
      ? await db.investorOrganization.findUnique({
          where: { id: organizationId },
          select: {
            onboarding_status: true,
            onboarding_approved: true,
            aml_approved: true,
          },
        })
      : await db.issuerOrganization.findUnique({
          where: { id: organizationId },
          select: {
            onboarding_status: true,
            onboarding_approved: true,
            aml_approved: true,
          },
        });
  return org;
}
