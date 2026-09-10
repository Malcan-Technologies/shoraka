import { prisma } from "../../lib/prisma";
import { seedMasterPartiesIfEmpty } from "./service";
import { isInitialCorporateOnboardingStatus } from "@cashsouk/types";
import {
  buildDirectorShareholderPeopleList,
  type BuildDirectorShareholderPeopleParams,
  type DirectorShareholderPeopleBuildResult,
  type MasterPartyPeopleSeed,
} from "../admin/build-people-list";

type Portal = "issuer" | "investor";

function orgWhere(portal: Portal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId, investor_organization_id: null }
    : { investor_organization_id: organizationId, issuer_organization_id: null };
}

async function readOrganizationOnboardingStatus(
  portal: Portal,
  organizationId: string
): Promise<string | null> {
  if (portal === "issuer") {
    if (typeof prisma.issuerOrganization?.findUnique !== "function") return null;
    const row = await prisma.issuerOrganization.findUnique({
      where: { id: organizationId },
      select: { onboarding_status: true },
    });
    return row?.onboarding_status ?? null;
  }
  if (typeof prisma.investorOrganization?.findUnique !== "function") return null;
  const row = await prisma.investorOrganization.findUnique({
    where: { id: organizationId },
    select: { onboarding_status: true },
  });
  return row?.onboarding_status ?? null;
}

export async function loadMasterPartiesForPeopleMerge(
  portal: Portal,
  organizationId: string
): Promise<MasterPartyPeopleSeed[]> {
  const model = prisma.organizationPartyProfile;
  if (!model?.findMany) return [];
  const rows = await model.findMany({
    where: orgWhere(portal, organizationId),
    select: {
      party_key: true,
      membership_status: true,
      entity_type: true,
      name: true,
      identity_number: true,
      is_director: true,
      is_shareholder: true,
      shareholding_percentage: true,
      email: true,
      origin: true,
    },
  });
  return rows.map((row) => ({
    partyKey: row.party_key,
    membershipStatus: row.membership_status,
    entityType: row.entity_type,
    name: row.name,
    identityNumber: row.identity_number,
    isDirector: row.is_director,
    isShareholder: row.is_shareholder,
    shareholdingPercentage: row.shareholding_percentage?.toString() ?? null,
    email: row.email,
    origin: row.origin ?? null,
  }));
}

export async function buildDirectorShareholderPeopleListWithMaster(
  portal: Portal,
  organizationId: string,
  params: Omit<BuildDirectorShareholderPeopleParams, "masterParties">
): Promise<DirectorShareholderPeopleBuildResult> {
  await seedMasterPartiesIfEmpty(portal, organizationId);
  const masterParties = await loadMasterPartiesForPeopleMerge(portal, organizationId);
  let parentCorporateRequestId = params.parentCorporateRequestId ?? null;
  if (!parentCorporateRequestId && typeof prisma.regTankOnboarding?.findFirst === "function") {
    const onboarding = await prisma.regTankOnboarding.findFirst({
      where: {
        onboarding_type: "CORPORATE",
        ...(portal === "issuer"
          ? { issuer_organization_id: organizationId }
          : { investor_organization_id: organizationId }),
      },
      select: { request_id: true },
      orderBy: { created_at: "desc" },
    });
    parentCorporateRequestId = onboarding?.request_id ?? null;
  }
  const onboardingStatus = await readOrganizationOnboardingStatus(portal, organizationId);
  return buildDirectorShareholderPeopleList({
    ...params,
    masterParties,
    parentCorporateRequestId,
    initialCorporateOnboarding: isInitialCorporateOnboardingStatus(onboardingStatus),
  });
}
