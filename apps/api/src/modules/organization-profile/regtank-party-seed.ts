import { OrganizationPartyMembershipStatus, Prisma } from "@prisma/client";
import {
  canonicalPartyIdentityKey,
  extractRegTankPersonSeedFields,
  findExistingPartyForIdentityKey,
  getCtosPartySupplementRequestId,
  isMasterFieldEmpty,
  observationWithIdentityConflict,
  parseComrepCalendarDate,
  parsePersonIdentityConflict,
  observedPartyBlockedByIdentityConflict,
  type PersonIdentityConflict,
  type ProfileFieldSources,
  type ProfileValueSource,
  type RegTankPersonSeedFields,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { getRegTankAPIClient } from "../regtank/api-client";
import { AppError } from "../../lib/http/error-handler";
import {
  asJson,
  fillEmptyMaster,
  parseFieldSources,
  parseDateInput,
  serializeParty,
  stampSource,
} from "./serialize";

type Portal = "issuer" | "investor";

function orgWhere(portal: Portal, organizationId: string) {
  return portal === "issuer"
    ? { issuer_organization_id: organizationId, investor_organization_id: null }
    : { investor_organization_id: organizationId, issuer_organization_id: null };
}

function asObservation(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function storedIdentityKey(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  return canonicalPartyIdentityKey(trimmed) ?? trimmed;
}

export function collidingPartyForIdentity(params: {
  rows: Array<{
    id: string;
    party_key: string;
    identity_number?: string | null;
    entity_type?: string | null;
    membership_status?: string | null;
  }>;
  selfId: string;
  identityKey: string;
  entityType?: string | null;
}) {
  const others = params.rows.filter((row) => row.id !== params.selfId);
  return findExistingPartyForIdentityKey(others, params.identityKey, {
    entityType: params.entityType ?? null,
  });
}

export function planRegTankPersonSeed(params: {
  current: {
    id: string;
    party_key: string;
    name: string | null;
    email: string | null;
    identity_number: string | null;
    identity_prefix: string | null;
    gender: string | null;
    date_of_birth: Date | null;
    nationality: string | null;
    field_sources: unknown;
    entity_type?: string | null;
  };
  seed: RegTankPersonSeedFields;
  otherRows: Array<{
    id: string;
    party_key: string;
    identity_number?: string | null;
    entity_type?: string | null;
    membership_status?: string | null;
  }>;
}): {
  data: Prisma.OrganizationPartyProfileUpdateInput;
  sources: ProfileFieldSources;
  wrote: boolean;
  identityCollision: PersonIdentityConflict | null;
} {
  const source: ProfileValueSource = "REGTANK";
  let sources = parseFieldSources(params.current.field_sources);
  const data: Prisma.OrganizationPartyProfileUpdateInput = {};
  let wrote = false;

  const apply = <T,>(column: keyof Prisma.OrganizationPartyProfileUpdateInput, field: string, current: T, incoming: T) => {
    const result = fillEmptyMaster({ master: current, incoming, sources, field, source });
    sources = result.sources;
    if (result.wrote) {
      wrote = true;
      (data as Record<string, unknown>)[column as string] = result.value;
    }
  };

  apply("name", "name", params.current.name, params.seed.name);
  apply("gender", "gender", params.current.gender, params.seed.gender);
  apply("nationality", "nationality", params.current.nationality, params.seed.nationality);
  const incomingDob = parseDateInput(params.seed.dateOfBirth) ?? parseComrepCalendarDate(params.seed.dateOfBirth);
  apply("date_of_birth", "dateOfBirth", params.current.date_of_birth, incomingDob);

  const identityKey = storedIdentityKey(params.seed.identityNumber);
  let identityCollision: PersonIdentityConflict | null = null;
  if (identityKey && isMasterFieldEmpty(params.current.identity_number)) {
    const other = collidingPartyForIdentity({
      rows: params.otherRows,
      selfId: params.current.id,
      identityKey,
      entityType: params.current.entity_type ?? "INDIVIDUAL",
    });
    if (other) {
      identityCollision = {
        status: "BLOCKED",
        canonicalIdentity: identityKey,
        otherPartyId: other.id,
        otherPartyKey: other.party_key,
        otherMembershipStatus: String(other.membership_status ?? ""),
        source: "REGTANK_QUERY",
        at: new Date().toISOString(),
      };
    } else {
      apply("identity_number", "identityNumber", params.current.identity_number, identityKey);
      if (params.seed.identityPrefix) {
        apply("identity_prefix", "identityPrefix", params.current.identity_prefix, params.seed.identityPrefix);
      }
    }
  } else if (params.seed.identityPrefix && isMasterFieldEmpty(params.current.identity_prefix)) {
    apply("identity_prefix", "identityPrefix", params.current.identity_prefix, params.seed.identityPrefix);
  }

  if (wrote) {
    data.field_sources = asJson(sources);
  }

  return { data, sources, wrote, identityCollision };
}

export async function enrichPartyFromApprovedOnboardingQuery(params: {
  portal: Portal;
  organizationId: string;
  partyKey: string;
  requestId: string;
}): Promise<void> {
  const requestId = String(params.requestId ?? "").trim();
  if (!requestId) {
    logger.warn(params, "RegTank person profile seed skipped: missing requestId");
    return;
  }

  let details: unknown;
  try {
    details = await getRegTankAPIClient().queryOnboardingDetails(requestId);
  } catch (error) {
    logger.error(
      {
        ...params,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "RegTank queryOnboardingDetails failed after APPROVED (non-blocking)"
    );
    return;
  }

  const seed = extractRegTankPersonSeedFields(details);
  const party = await prisma.organizationPartyProfile.findFirst({
    where: { ...orgWhere(params.portal, params.organizationId), party_key: params.partyKey },
  });
  if (!party) {
    logger.warn(params, "RegTank person profile seed skipped: OPP not found");
    return;
  }

  const otherRows = await prisma.organizationPartyProfile.findMany({
    where: orgWhere(params.portal, params.organizationId),
    select: {
      id: true,
      party_key: true,
      identity_number: true,
      entity_type: true,
      membership_status: true,
    },
  });

  const planned = planRegTankPersonSeed({
    current: party,
    seed,
    otherRows,
  });

  const data: Prisma.OrganizationPartyProfileUpdateInput = { ...planned.data };
  delete data.party_key;

  const observation = asObservation(party.external_observation);
  if (planned.identityCollision) {
    const previous = parsePersonIdentityConflict(observation);
    const nextConflict =
      previous &&
      previous.status === "BLOCKED" &&
      previous.canonicalIdentity === planned.identityCollision.canonicalIdentity &&
      previous.otherPartyId === planned.identityCollision.otherPartyId
        ? { ...planned.identityCollision, at: previous.at }
        : planned.identityCollision;
    data.external_observation = asJson(observationWithIdentityConflict(observation, nextConflict));
  }

  const hasUpdate = planned.wrote || Boolean(planned.identityCollision);
  if (!hasUpdate) return;

  await prisma.organizationPartyProfile.update({
    where: { id: party.id },
    data,
  });
}

export async function enrichApprovedCtosPartySupplement(params: {
  portal: Portal;
  organizationId: string;
  partyKey: string;
  requestId: string;
  onboardingJson?: unknown;
}): Promise<void> {
  const fromSupplement = getCtosPartySupplementRequestId(params.onboardingJson);
  const requestId = String(params.requestId ?? "").trim() || fromSupplement;
  await enrichPartyFromApprovedOnboardingQuery({
    portal: params.portal,
    organizationId: params.organizationId,
    partyKey: params.partyKey,
    requestId,
  });
}

export async function resolvePersonIdentityConflict(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
  action: "KEEP_ONBOARDING" | "KEEP_CTOS";
}) {
  const row = await prisma.organizationPartyProfile.findFirst({
    where: { id: params.partyId, ...orgWhere(params.portal, params.organizationId) },
  });
  if (!row) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  const conflict = parsePersonIdentityConflict(row.external_observation);
  if (!conflict || conflict.status !== "BLOCKED") {
    throw new AppError(400, "IDENTITY_CONFLICT", "This Person has no identity conflict to resolve.");
  }

  if (params.action === "KEEP_CTOS") {
    if (row.membership_status !== OrganizationPartyMembershipStatus.MASTER_ACTIVE) {
      throw new AppError(
        400,
        "INVALID_PARTY_STATUS",
        "Only an active onboarding Person can be kept as the CTOS Person path."
      );
    }
    const updated = await prisma.organizationPartyProfile.update({
      where: { id: row.id },
      data: {
        membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
        external_observation: asJson(
          observationWithIdentityConflict(asObservation(row.external_observation), {
            ...conflict,
            status: "RESOLVED_KEEP_CTOS",
            at: new Date().toISOString(),
          })
        ),
      },
    });
    return serializeParty(updated);
  }

  if (conflict.otherMembershipStatus !== "EXTERNAL_OBSERVED") {
    throw new AppError(
      400,
      "IDENTITY_CONFLICT",
      "Keep onboarding Person is only available when the matching record is CTOS-observed."
    );
  }
  if (row.membership_status !== OrganizationPartyMembershipStatus.MASTER_ACTIVE) {
    throw new AppError(400, "INVALID_PARTY_STATUS", "Only an active Person can keep the onboarding identity.");
  }

  let sources = parseFieldSources(row.field_sources);
  const identityWrite = fillEmptyMaster({
    master: row.identity_number,
    incoming: conflict.canonicalIdentity,
    sources,
    field: "identityNumber",
    source: "REGTANK",
  });
  const nextIdentity = identityWrite.wrote ? identityWrite.value : row.identity_number ?? conflict.canonicalIdentity;
  if (identityWrite.wrote) sources = identityWrite.sources;
  else if (isMasterFieldEmpty(row.identity_number)) {
    sources = stampSource(sources, "identityNumber", "REGTANK");
  }
  const updated = await prisma.organizationPartyProfile.update({
    where: { id: row.id },
    data: {
      identity_number: nextIdentity,
      field_sources: asJson(sources),
      external_observation: asJson(
        observationWithIdentityConflict(asObservation(row.external_observation), {
          ...conflict,
          status: "RESOLVED_KEEP_ONBOARDING",
          at: new Date().toISOString(),
        })
      ),
    },
  });
  return serializeParty(updated);
}

export async function assertObservedPartyNotBlockedByIdentityConflict(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
}): Promise<void> {
  const parties = await prisma.organizationPartyProfile.findMany({
    where: orgWhere(params.portal, params.organizationId),
    select: { id: true, party_key: true, membership_status: true, external_observation: true },
  });
  const observed = parties.find((row) => row.id === params.partyId);
  if (!observed) return;
  if (
    observedPartyBlockedByIdentityConflict({
      observedPartyId: observed.id,
      observedPartyKey: observed.party_key,
      parties: parties.map((row) => ({
        id: row.id,
        membershipStatus: row.membership_status,
        externalObservation: row.external_observation,
      })),
    })
  ) {
    throw new AppError(
      400,
      "IDENTITY_CONFLICT",
      "This Person's identity matches another Person. Resolve the identity conflict first."
    );
  }
}
