/**
 * SECTION: Block issuer application submit while any director/shareholder row is still actionable
 * WHY: Issuer submit uses {@link isReadyForSubmit} (onboarding only), independent of AML
 * INPUT: Issuer org id
 * OUTPUT: throws AppError DIRECTOR_SHAREHOLDER_PENDING or returns void / readiness object
 * WHERE USED: ApplicationService, issuer org API fields
 */

import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { isReadyForSubmit } from "@cashsouk/types";
import { OrganizationService } from "../organization/service";
import { buildDirectorShareholderPeopleListWithMaster } from "../organization-profile/load-master-parties-for-people";

const DIRECTOR_SHAREHOLDER_PENDING_MESSAGE =
  "Director/Shareholder information updated. Please review. Complete onboarding on your company profile before you submit an application.";

export async function getIssuerDirectorShareholderSubmitReadiness(issuerOrganizationId: string): Promise<{
  ready: boolean;
  message?: string;
}> {
  try {
    await assertIssuerOrgDirectorShareholderOnboardingReady(issuerOrganizationId);
    return { ready: true };
  } catch (e) {
    if (e instanceof AppError && e.code === "DIRECTOR_SHAREHOLDER_PENDING") {
      return { ready: false, message: e.message };
    }
    throw e;
  }
}

export async function assertIssuerOrgDirectorShareholderOnboardingReady(
  issuerOrganizationId: string
): Promise<void> {
  const org = await prisma.issuerOrganization.findUnique({
    where: { id: issuerOrganizationId },
    select: { corporate_entities: true, director_kyc_status: true, director_aml_status: true },
  });
  if (!org) {
    throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Issuer organization not found");
  }

  const organizationService = new OrganizationService();
  const extras = await organizationService.getIssuerPartyListExtras(issuerOrganizationId);

  const partyBuild = await buildDirectorShareholderPeopleListWithMaster("issuer", issuerOrganizationId, {
    ctos: extras.latestOrganizationCtosCompanyJson ?? null,
    issuerDirectorKycStatus: org.director_kyc_status ?? null,
    issuerDirectorAmlStatus: org.director_aml_status ?? null,
    ctosPartySupplements: extras.ctosPartySupplements,
    corporateEntities: org.corporate_entities ?? null,
  });

  if (!isReadyForSubmit(partyBuild.people)) {
    throw new AppError(400, "DIRECTOR_SHAREHOLDER_PENDING", DIRECTOR_SHAREHOLDER_PENDING_MESSAGE);
  }
}
