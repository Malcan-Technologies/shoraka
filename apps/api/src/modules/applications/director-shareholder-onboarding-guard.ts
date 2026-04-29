/**
 * SECTION: Block issuer create/submit until AML screening is Approved for all CTOS people rows
 * WHY: Single derived gate from people[].screening (no stored workflow JSON)
 * INPUT: Issuer org id
 * OUTPUT: throws AppError DIRECTOR_SHAREHOLDER_PENDING or returns void / readiness object
 * WHERE USED: ApplicationService, issuer org API fields
 */

import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { filterVisiblePeopleRows, normalizeRawStatus, type ApplicationPersonRow } from "@cashsouk/types";
import { OrganizationService } from "../organization/service";
import { buildAdminPeopleList } from "../admin/build-people-list";

const DIRECTOR_SHAREHOLDER_PENDING_MESSAGE =
  "Please submit onboarding for all directors/shareholders before submitting.";

function isReadyStatus(statusRaw: unknown): boolean {
  const s = normalizeRawStatus(statusRaw);
  return (
    s === "WAIT_FOR_APPROVAL" ||
    s === "WAITING_FOR_APPROVAL" ||
    s === "PENDING_APPROVAL" ||
    s === "APPROVED"
  );
}

function peopleHavePendingOnboarding(visible: ApplicationPersonRow[]): boolean {
  const individuals = visible.filter((p) => p.entityType === "INDIVIDUAL");
  if (individuals.length === 0) return false;
  return individuals.some((p) => !isReadyStatus(p.onboarding?.status));
}

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

  const people = buildAdminPeopleList({
    ctos: extras.latestOrganizationCtosCompanyJson ?? null,
    issuerDirectorKycStatus: org.director_kyc_status ?? null,
    issuerDirectorAmlStatus: org.director_aml_status ?? null,
    ctosPartySupplements: extras.ctosPartySupplements,
    corporateEntities: org.corporate_entities ?? null,
  });

  const visible = filterVisiblePeopleRows(people);
  const visibleIndividuals = visible.filter((p) => p.entityType === "INDIVIDUAL");
  if (visibleIndividuals.length === 0) {
    return;
  }
  if (peopleHavePendingOnboarding(visibleIndividuals)) {
    throw new AppError(400, "DIRECTOR_SHAREHOLDER_PENDING", DIRECTOR_SHAREHOLDER_PENDING_MESSAGE);
  }
}
