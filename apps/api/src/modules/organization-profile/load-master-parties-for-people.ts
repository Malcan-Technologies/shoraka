import { prisma } from "../../lib/prisma";
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
  }));
}

export async function buildDirectorShareholderPeopleListWithMaster(
  portal: Portal,
  organizationId: string,
  params: Omit<BuildDirectorShareholderPeopleParams, "masterParties">
): Promise<DirectorShareholderPeopleBuildResult> {
  const masterParties = await loadMasterPartiesForPeopleMerge(portal, organizationId);
  return buildDirectorShareholderPeopleList({ ...params, masterParties });
}
