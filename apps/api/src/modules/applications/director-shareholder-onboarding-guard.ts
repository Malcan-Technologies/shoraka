/**
 * SECTION: Block issuer create/submit until CTOS party onboarding reached wait-for-approval
 * WHY: Consistent org data before applications; no AML gate here
 * INPUT: Issuer org id + org JSON blobs + supplements
 * OUTPUT: throws AppError DIRECTOR_SHAREHOLDER_PENDING or returns void
 * WHERE USED: ApplicationService.createApplication, updateApplicationStatus, amendment resubmit
 */

import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import {
  getCtosPartySupplementPipelineStatus,
  getCtosPartySupplementRequestId,
  getDirectorShareholderDisplayRows,
  isCtosIndividualKycEligibleRow,
  isLegacyCtosPartyKycApproved,
  normalizeDirectorShareholderIdKey,
} from "@cashsouk/types";
import { OrganizationService } from "../organization/service";

const DIRECTOR_SHAREHOLDER_PENDING_MESSAGE =
  "Please complete onboarding for all required directors/shareholders before submitting.";

const WAIT_FOR_APPROVAL_STATUSES = new Set([
  "WAITING_FOR_APPROVAL",
  "WAIT_FOR_APPROVAL",
  "PENDING_APPROVAL",
]);

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

  const supplementPartyKeys = new Set<string>();
  const supplementByPartyKey = new Map<string, unknown>();
  for (const s of extras.ctosPartySupplements) {
    const key = normalizeDirectorShareholderIdKey(s.partyKey);
    if (!key) continue;
    supplementPartyKeys.add(key);
    supplementByPartyKey.set(key, s.onboardingJson);
  }

  const rows = getDirectorShareholderDisplayRows({
    corporateEntities: org.corporate_entities,
    directorKycStatus: org.director_kyc_status,
    directorAmlStatus: org.director_aml_status ?? null,
    organizationCtosCompanyJson: extras.latestOrganizationCtosCompanyJson ?? null,
    ctosPartySupplements: extras.ctosPartySupplements,
    sentRowIds: null,
  });

  for (const row of rows) {
    if (!isCtosIndividualKycEligibleRow(row)) continue;
    const partyKey = normalizeDirectorShareholderIdKey(
      row.idNumber?.trim() || row.registrationNumber?.trim() || row.enquiryId?.trim() || ""
    );
    if (!partyKey) continue;
    if (isLegacyCtosPartyKycApproved(partyKey, org.director_kyc_status)) continue;

    if (!supplementPartyKeys.has(partyKey)) {
      throw new AppError(400, "DIRECTOR_SHAREHOLDER_PENDING", DIRECTOR_SHAREHOLDER_PENDING_MESSAGE);
    }

    const onboardingRoot = supplementByPartyKey.get(partyKey);
    const requestId = getCtosPartySupplementRequestId(onboardingRoot ?? {}).trim();
    if (!requestId) {
      throw new AppError(400, "DIRECTOR_SHAREHOLDER_PENDING", DIRECTOR_SHAREHOLDER_PENDING_MESSAGE);
    }

    const status = getCtosPartySupplementPipelineStatus(onboardingRoot ?? null).trim().toUpperCase();
    if (!WAIT_FOR_APPROVAL_STATUSES.has(status)) {
      throw new AppError(400, "DIRECTOR_SHAREHOLDER_PENDING", DIRECTOR_SHAREHOLDER_PENDING_MESSAGE);
    }
  }
}
