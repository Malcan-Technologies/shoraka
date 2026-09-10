import { Prisma } from "@prisma/client";
import {
  isLegacyCtosPartyKycApproved,
  mergeCtosPartySupplementDocument,
  planPersonEmailWrite,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";

type Portal = "issuer" | "investor";

function orgWhere(portal: Portal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId, investor_organization_id: null }
    : { investor_organization_id: organizationId, issuer_organization_id: null };
}

async function loadDirectorKycStatus(portal: Portal, organizationId: string): Promise<unknown> {
  if (portal === "issuer") {
    const row = await prisma.issuerOrganization.findUnique({
      where: { id: organizationId },
      select: { director_kyc_status: true },
    });
    return row?.director_kyc_status ?? null;
  }
  const row = await prisma.investorOrganization.findUnique({
    where: { id: organizationId },
    select: { director_kyc_status: true },
  });
  return row?.director_kyc_status ?? null;
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
 * supplement email is a snapshot. Applies original RegTank lock/reset rules.
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
  const directorKycStatus = await loadDirectorKycStatus(params.portal, params.organizationId);
  const plan = planPersonEmailWrite({
    currentMasterEmail: party.email,
    incomingEmail: params.email,
    supplementRoot: existing?.onboarding_json,
    legacyKycApproved: isLegacyCtosPartyKycApproved(params.partyKey, directorKycStatus),
    fillEmptyOnly: params.fillEmptyOnly,
  });

  if (plan.action === "noop") {
    return { email: plan.email };
  }
  if (plan.action === "reject") {
    throw new AppError(400, plan.code, plan.message);
  }

  const updated = await prisma.organizationPartyProfile.update({
    where: { id: party.id },
    data: { email: plan.email },
    select: { email: true, party_key: true },
  });

  if (plan.snapshotSupplement && (existing || plan.email)) {
    if (!existing && isLegacyCtosPartyKycApproved(params.partyKey, directorKycStatus)) {
      return { email: updated.email };
    }
    const merged = mergeCtosPartySupplementDocument(existing?.onboarding_json, {
      onboarding: plan.email ? { email: plan.email } : undefined,
      pipelineReset: plan.pipelineReset,
      screeningReset: plan.screeningReset,
    });
    if (existing) {
      await prisma.ctosPartySupplement.update({
        where: { id: existing.id },
        data: { onboarding_json: merged as Prisma.InputJsonValue },
      });
    } else if (plan.email) {
      await prisma.ctosPartySupplement.create({
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
}
