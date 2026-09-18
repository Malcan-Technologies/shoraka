import { Prisma } from "@prisma/client";
import {
  getDirectorKycPartyRecord,
  getLegacyDirectorAmlPersonContext,
  isLegacyCtosPartyKycApproved,
  mergeCtosPartySupplementDocument,
  planPersonEmailWrite,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { asJson, parseFieldSources, stampSource } from "./serialize";

type Portal = "issuer" | "investor";

function orgWhere(portal: Portal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId, investor_organization_id: null }
    : { investor_organization_id: organizationId, issuer_organization_id: null };
}

async function loadLegacyDirectorStatuses(
  portal: Portal,
  organizationId: string
): Promise<{ kyc: unknown; aml: unknown }> {
  if (portal === "issuer") {
    const row = await prisma.issuerOrganization.findUnique({
      where: { id: organizationId },
      select: { director_kyc_status: true, director_aml_status: true },
    });
    return {
      kyc: row?.director_kyc_status ?? null,
      aml: row?.director_aml_status ?? null,
    };
  }
  const row = await prisma.investorOrganization.findUnique({
    where: { id: organizationId },
    select: { director_kyc_status: true, director_aml_status: true },
  });
  return {
    kyc: row?.director_kyc_status ?? null,
    aml: row?.director_aml_status ?? null,
  };
}

async function findPartySupplement(portal: Portal, organizationId: string, partyKey: string) {
  return prisma.ctosPartySupplement.findFirst({
    where:
      portal === "issuer"
        ? { issuer_organization_id: organizationId, party_key: partyKey }
        : { investor_organization_id: organizationId, party_key: partyKey },
  });
}

/**
 * Single Person Email write path: OrganizationPartyProfile.email is master,
 * supplement email is a snapshot. Never writes User/Cognito email.
 * Master + snapshot persist atomically. Post-KYC/AML writes do not reset those pipelines.
 */
export async function writeOrganizationPartyEmail(params: {
  portal: Portal;
  organizationId: string;
  partyKey: string;
  email: unknown;
  fillEmptyOnly?: boolean;
}): Promise<{ email: string | null }> {
  const party = await prisma.organizationPartyProfile.findFirst({
    where: { ...orgWhere(params.portal, params.organizationId), party_key: params.partyKey },
  });
  if (!party) {
    throw new AppError(404, "NOT_FOUND", "Party profile not found");
  }

  const existing = await findPartySupplement(params.portal, params.organizationId, params.partyKey);
  const legacyStatuses = await loadLegacyDirectorStatuses(params.portal, params.organizationId);
  const legacyKycRecord = getDirectorKycPartyRecord(params.partyKey, legacyStatuses.kyc);
  const legacyAmlContext = getLegacyDirectorAmlPersonContext(
    params.partyKey,
    legacyStatuses.kyc,
    legacyStatuses.aml
  );
  const plan = planPersonEmailWrite({
    currentMasterEmail: party.email,
    incomingEmail: params.email,
    legacyPeopleEmail: legacyKycRecord?.email ?? legacyAmlContext?.email,
    supplementRoot: existing?.onboarding_json,
    onboardingStatus:
      legacyKycRecord?.kycStatus == null ? null : String(legacyKycRecord.kycStatus),
    screeningStatus: legacyAmlContext?.screeningStatus,
    legacyKycApproved: isLegacyCtosPartyKycApproved(params.partyKey, legacyStatuses.kyc),
    fillEmptyOnly: params.fillEmptyOnly,
  });

  if (plan.action === "noop") {
    return { email: plan.email };
  }
  if (plan.action === "reject") {
    throw new AppError(400, plan.code, plan.message);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.organizationPartyProfile.update({
      where: { id: party.id },
      data: {
        email: plan.email,
        field_sources: asJson(
          stampSource(parseFieldSources(party.field_sources), "email", "SYSTEM")
        ),
      },
      select: { email: true, party_key: true },
    });

    if (plan.snapshotSupplement && (existing || plan.email)) {
      const merged = mergeCtosPartySupplementDocument(existing?.onboarding_json, {
        onboarding: { email: plan.email },
        pipelineReset: plan.pipelineReset,
        screeningReset: plan.screeningReset,
      });
      if (existing) {
        await tx.ctosPartySupplement.update({
          where: { id: existing.id },
          data: { onboarding_json: merged as Prisma.InputJsonValue },
        });
      } else if (plan.email) {
        await tx.ctosPartySupplement.create({
          data: {
            issuer_organization_id: params.portal === "issuer" ? params.organizationId : null,
            investor_organization_id: params.portal === "investor" ? params.organizationId : null,
            party_key: params.partyKey,
            onboarding_json: merged as Prisma.InputJsonValue,
          },
        });
      }
    }

    return { email: updated.email };
  });
}
