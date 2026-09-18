/**
 * Party-scoped RegTank refresh for later-added People & Access rows.
 * Does not refresh the parent organisation COD, CTOS source-of-truth, or adopt/structure.
 */
import { OrganizationMemberRole, OrganizationType } from "@prisma/client";
import {
  collectPartyRegTankRefreshIds,
  isLaterAddedCompanyPerson,
  isPartyRegTankProcessTerminal,
  normalizeDirectorShareholderIdKey,
  parseCtosPartySupplement,
  partyAmlRefreshIds,
  partyHasRegTankRefreshIds,
  partyKeyMatchesLookup,
  partyKycRefreshIds,
  pickPreferredDirectorShareholderOnboarding,
  pickPreferredDirectorShareholderScreening,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { OrganizationService } from "../organization/service";
import { RegTankAPIClient } from "../regtank/api-client";
import { extractGovernmentIdFromCorporateUserInfo } from "../regtank/helpers/extract-government-id";
import {
  extractBusinessNameFromCorpShareholderRow,
  extractBusinessNumberFromCorpShareholderRow,
} from "../regtank/helpers/business-shareholder-kyb-match";
import { REGTANK_RATE_LIMITED_CODE } from "../regtank/helpers/regtank-rate-limit";
import {
  runExclusiveOnboardingRefresh,
} from "../regtank/helpers/regtank-refresh-lock";
import {
  RegTankRefreshSession,
  RegTankRefreshClient,
} from "../regtank/helpers/regtank-refresh-session";
import {
  extractRegTankScreeningPatch,
  extractRegTankStatus,
  syncCtosPartyRegTankStatus,
} from "./regtank-party-sync";

export const PARTY_STATUS_REFRESHED_MESSAGE = "Status refreshed.";
export const PARTY_STATUS_REFRESH_FAILED_MESSAGE =
  "Unable to refresh this status right now. Please try again.";
export const PARTY_STATUS_REFRESH_RECENTLY_MESSAGE =
  "Status was refreshed recently. Please wait a moment and try again.";

type Portal = "issuer" | "investor";

export type RefreshPartyRegTankStatusDeps = {
  organizationService?: Pick<OrganizationService, "getOrganization" | "getCorporateEntities">;
  regTankClient?: RegTankRefreshClient;
};

export type RefreshPartyRegTankStatusResult = {
  message: string;
  refreshedSources: string[];
};

type RefreshIds = ReturnType<typeof collectPartyRegTankRefreshIds>;

type DiscoveredRefreshIds = RefreshIds & {
  confirmedScreeningAbsent?: boolean;
};

type AdminRefreshParty = {
  id: string;
  party_key: string;
  origin: string | null;
  membership_status: string;
  identity_number: string | null;
  entity_type: string;
  name: string | null;
  is_director: boolean;
  is_shareholder: boolean;
};

type RegTankPartyCandidate = {
  entityType: "INDIVIDUAL" | "CORPORATE";
  name: string;
  identityNumber: string | null;
  onboardingRequestId: string | null;
  screeningRequestId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function formFieldValue(source: unknown, fieldName: string): string {
  const row = nestedRecord(source);
  const formContent = nestedRecord(row?.formContent);
  const content = nestedRecord(formContent?.content);
  const fields = Array.isArray(content?.content)
    ? content.content
    : Array.isArray(formContent?.content)
      ? formContent.content
      : [];
  const wanted = fieldName.toLowerCase();
  for (const field of fields) {
    const rec = nestedRecord(field);
    if (text(rec?.fieldName).toLowerCase() === wanted) return text(rec?.fieldValue);
  }
  return "";
}

function individualCandidate(row: Record<string, unknown>): RegTankPartyCandidate {
  const userInfo = nestedRecord(row.corporateUserRequestInfo);
  const formName = `${formFieldValue(userInfo, "First Name")} ${formFieldValue(userInfo, "Last Name")}`.trim();
  const directName = [text(userInfo?.firstName), text(userInfo?.middleName), text(userInfo?.lastName)]
    .filter(Boolean)
    .join(" ");
  const request = nestedRecord(row.corporateIndividualRequest);
  const screening = nestedRecord(row.kycRequestInfo);
  return {
    entityType: "INDIVIDUAL",
    name: formName || text(userInfo?.fullName) || directName || text(row.name),
    identityNumber: extractGovernmentIdFromCorporateUserInfo(userInfo ?? {}) || null,
    onboardingRequestId: text(request?.requestId) || text(row.requestId) || null,
    screeningRequestId: text(screening?.kycId) || null,
  };
}

function corporateCandidate(row: Record<string, unknown>): RegTankPartyCandidate {
  const request = nestedRecord(row.corporateOnboardingRequest);
  const screening = nestedRecord(row.kybRequestDto);
  return {
    entityType: "CORPORATE",
    name:
      extractBusinessNameFromCorpShareholderRow(row) ||
      text(row.businessName) ||
      text(row.companyName) ||
      text(row.name),
    identityNumber:
      extractBusinessNumberFromCorpShareholderRow(row) ||
      text(row.businessNumber) ||
      text(row.registrationNumber) ||
      null,
    onboardingRequestId: text(request?.requestId) || text(row.requestId) || null,
    screeningRequestId: text(screening?.kybId) || text(row.kybId) || null,
  };
}

function listRegTankPartyCandidates(parentCod: unknown): RegTankPartyCandidate[] {
  const root = nestedRecord(Array.isArray(parentCod) ? parentCod[0] : parentCod);
  if (!root) return [];
  const candidates: RegTankPartyCandidate[] = [];
  for (const key of ["corpIndvDirectors", "corpIndvShareholders"] as const) {
    const rows = root[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const rec = nestedRecord(row);
      if (rec) candidates.push(individualCandidate(rec));
    }
  }
  const corporateRows = root.corpBizShareholders;
  if (Array.isArray(corporateRows)) {
    for (const row of corporateRows) {
      const rec = nestedRecord(row);
      if (rec) candidates.push(corporateCandidate(rec));
    }
  }
  return candidates;
}

function normalizedName(value: string | null): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function matchingCandidates(
  party: AdminRefreshParty,
  candidates: RegTankPartyCandidate[]
): RegTankPartyCandidate[] {
  const entityType = party.entity_type === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL";
  const sameType = candidates.filter((candidate) => candidate.entityType === entityType);
  const partyIdentity = normalizeDirectorShareholderIdKey(
    party.identity_number || (!party.party_key.startsWith("user:") ? party.party_key : "")
  );
  if (partyIdentity) {
    const identityMatches = sameType.filter(
      (candidate) =>
        normalizeDirectorShareholderIdKey(candidate.identityNumber) === partyIdentity
    );
    if (identityMatches.length > 0) return identityMatches;
  }
  const name = normalizedName(party.name);
  if (!name) return [];
  const nameMatches = sameType.filter((candidate) => normalizedName(candidate.name) === name);
  if (
    partyIdentity &&
    nameMatches.some((candidate) => {
      const candidateIdentity = normalizeDirectorShareholderIdKey(candidate.identityNumber);
      return Boolean(candidateIdentity) && candidateIdentity !== partyIdentity;
    })
  ) {
    throw new AppError(
      409,
      "AMBIGUOUS_REGTANK_PARTY",
      "RegTank has a person with the same name but a different identity number. Review the identity details before syncing."
    );
  }
  if (nameMatches.length > 1 && !nameMatchesRepresentOneParty(nameMatches)) {
    throw new AppError(
      409,
      "AMBIGUOUS_REGTANK_PARTY",
      "More than one RegTank person matches this profile. Review the identity details before syncing."
    );
  }
  return nameMatches;
}

function sharedNonemptyKey(values: Array<string | null>): string | null {
  if (values.length === 0 || values.some((value) => !value)) return null;
  const unique = new Set(values);
  return unique.size === 1 ? values[0] : null;
}

/** Director + shareholder rows for one person may share one identity or one screening ID. */
function nameMatchesRepresentOneParty(matches: RegTankPartyCandidate[]): boolean {
  const identities = matches.map((candidate) =>
    normalizeDirectorShareholderIdKey(candidate.identityNumber)
  );
  const presentIdentities = identities.filter((id): id is string => Boolean(id));
  if (new Set(presentIdentities).size > 1) return false;
  if (sharedNonemptyKey(identities)) return true;
  return Boolean(
    sharedNonemptyKey(matches.map((candidate) => text(candidate.screeningRequestId) || null))
  );
}

function emptyRefreshIds(): RefreshIds {
  return {
    individualOnboardingRequestId: null,
    entityOnboardingRequestId: null,
    corporateOnboardingRequestId: null,
    kycId: null,
    kybId: null,
  };
}

function idsFromSupplement(
  raw: unknown,
  entityType: string
): RefreshIds {
  const supplement = parseCtosPartySupplement(raw);
  return collectPartyRegTankRefreshIds({
    onboarding: { id: supplement.requestId, status: supplement.status },
    screening: supplement.screening
      ? { id: supplement.screening.requestId, status: supplement.screening.status }
      : null,
    requestId: supplement.requestId,
    screeningRequestId: supplement.screening?.requestId ?? null,
    directorEodRequestId: entityType === "CORPORATE" ? null : supplement.requestId,
    shareholderEodRequestId: null,
    partyCorporateRequestId: entityType === "CORPORATE" ? supplement.requestId : null,
  });
}

function mergeRefreshIds(primary: RefreshIds, fallback: RefreshIds): RefreshIds {
  return {
    individualOnboardingRequestId:
      primary.individualOnboardingRequestId ?? fallback.individualOnboardingRequestId,
    entityOnboardingRequestId:
      primary.entityOnboardingRequestId ?? fallback.entityOnboardingRequestId,
    corporateOnboardingRequestId:
      primary.corporateOnboardingRequestId ?? fallback.corporateOnboardingRequestId,
    kycId: primary.kycId ?? fallback.kycId,
    kybId: primary.kybId ?? fallback.kybId,
  };
}

function findPersonForParty(
  people: ApplicationPersonRow[],
  partyKey: string,
  identityNumber: string | null
): ApplicationPersonRow | undefined {
  return people.find(
    (row) =>
      partyKeyMatchesLookup(row.matchKey, partyKey) ||
      (identityNumber != null && partyKeyMatchesLookup(row.matchKey, identityNumber))
  );
}

function screeningIdFromDetails(
  details: unknown,
  entityType: "INDIVIDUAL" | "CORPORATE"
): string | null {
  const root = nestedRecord(Array.isArray(details) ? details[0] : details);
  if (!root) return null;
  if (entityType === "INDIVIDUAL") {
    const request = nestedRecord(root.kycRequestInfo);
    return text(request?.kycId) || text(root.kycId) || null;
  }
  const request = nestedRecord(root.kybRequestDto);
  return text(request?.kybId) || text(root.kybId) || null;
}

function inspectChildScreening(
  details: unknown,
  entityType: "INDIVIDUAL" | "CORPORATE"
): { kind: "id"; id: string } | { kind: "absent" } | { kind: "malformed" } {
  if (!extractRegTankStatus(details)) return { kind: "malformed" };
  const id = screeningIdFromDetails(details, entityType);
  return id ? { kind: "id", id } : { kind: "absent" };
}

function providerRefreshFailed(): AppError {
  return new AppError(
    502,
    "PROVIDER_REFRESH_FAILED",
    PARTY_STATUS_REFRESH_FAILED_MESSAGE
  );
}

async function preferredScreeningId(params: {
  session: RegTankRefreshSession;
  ids: Set<string>;
  entityType: "INDIVIDUAL" | "CORPORATE";
}): Promise<string | null> {
  if (params.ids.size === 0) return null;
  if (params.ids.size === 1) return [...params.ids][0] ?? null;
  let preferred: { status: string; id: string } | null = null;
  for (const id of params.ids) {
    const body =
      params.entityType === "CORPORATE"
        ? await params.session.queryKYBStatus(id)
        : await params.session.queryKYCStatus(id);
    const patch = extractRegTankScreeningPatch(body, id);
    const status = text(patch?.status);
    if (!status) throw providerRefreshFailed();
    preferred = pickPreferredDirectorShareholderScreening(preferred, { status, id });
  }
  if (!preferred?.id) throw providerRefreshFailed();
  return preferred.id;
}

async function discoverAdminRefreshIds(params: {
  portal: Portal;
  organizationId: string;
  party: AdminRefreshParty;
  session: RegTankRefreshSession;
}): Promise<DiscoveredRefreshIds> {
  const supplement = await prisma.ctosPartySupplement.findFirst({
    where:
      params.portal === "issuer"
        ? {
            issuer_organization_id: params.organizationId,
            party_key: params.party.party_key,
          }
        : {
            investor_organization_id: params.organizationId,
            party_key: params.party.party_key,
          },
    select: { onboarding_json: true },
  });
  const stored = idsFromSupplement(
    supplement?.onboarding_json,
    params.party.entity_type
  );
  const laterAdded = isLaterAddedCompanyPerson({
    origin: params.party.origin,
    partyKey: params.party.party_key,
  });
  const hasPipeline = partyKycRefreshIds(stored).length > 0;
  const hasScreening = partyAmlRefreshIds(stored).length > 0;
  if (laterAdded && hasPipeline && hasScreening) return stored;

  const onboarding = await prisma.regTankOnboarding.findFirst({
    where: {
      onboarding_type: "CORPORATE",
      ...(params.portal === "issuer"
        ? { issuer_organization_id: params.organizationId }
        : { investor_organization_id: params.organizationId }),
    },
    orderBy: { created_at: "desc" },
    select: { request_id: true },
  });
  const parentRequestId = text(onboarding?.request_id);
  if (!parentRequestId) return stored;

  const parentCod = await params.session.getCorporateOnboardingDetails(parentRequestId);
  const matches = matchingCandidates(
    params.party,
    listRegTankPartyCandidates(parentCod)
  );
  if (matches.length === 0) return stored;

  const discovered = emptyRefreshIds();
  const onboardingIds = [
    ...new Set(
      matches
        .map((candidate) => candidate.onboardingRequestId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const parentScreeningIds = new Set(
    matches
      .map((candidate) => candidate.screeningRequestId)
      .filter((id): id is string => Boolean(id))
  );
  const entityType =
    params.party.entity_type === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL";

  const childScreeningIds = new Set<string>();
  let childMalformed = false;
  let childConfirmedAbsent = onboardingIds.length > 0;
  let preferredOnboarding: { status: string; id: string } | null = null;
  for (const requestId of onboardingIds) {
    const details =
      entityType === "CORPORATE"
        ? await params.session.getCorporateOnboardingDetails(requestId)
        : await params.session.getEntityOnboardingDetails(requestId);
    const status = extractRegTankStatus(details);
    if (status) {
      preferredOnboarding = pickPreferredDirectorShareholderOnboarding(preferredOnboarding, {
        status,
        id: requestId,
      });
    }
    const inspection = inspectChildScreening(details, entityType);
    if (inspection.kind === "malformed") {
      childMalformed = true;
      childConfirmedAbsent = false;
    } else if (inspection.kind === "id") {
      childScreeningIds.add(inspection.id);
      childConfirmedAbsent = false;
    }
  }

  const preferredRequestId = preferredOnboarding?.id ?? onboardingIds[0] ?? null;
  if (entityType === "CORPORATE") {
    discovered.corporateOnboardingRequestId = preferredRequestId;
  } else {
    discovered.entityOnboardingRequestId = preferredRequestId;
  }

  if (!laterAdded && (onboardingIds.length === 0 || childMalformed)) {
    throw providerRefreshFailed();
  }

  const screeningIds = laterAdded
    ? childScreeningIds.size > 0
      ? childScreeningIds
      : parentScreeningIds
    : childScreeningIds;

  const screeningId = await preferredScreeningId({
    session: params.session,
    ids: screeningIds,
    entityType,
  });
  if (entityType === "CORPORATE") {
    discovered.kybId = screeningId;
  } else {
    discovered.kycId = screeningId;
  }
  if (laterAdded) return mergeRefreshIds(stored, discovered);
  return {
    ...discovered,
    confirmedScreeningAbsent: screeningId == null && childConfirmedAbsent,
  };
}

async function runPartyRegTankSync(params: {
  portal: Portal;
  organizationId: string;
  partyId: string;
  partyKey: string;
  ids: DiscoveredRefreshIds | (() => Promise<DiscoveredRefreshIds>);
  regTankClient?: RegTankRefreshClient;
  session?: RegTankRefreshSession;
  requirePersistence?: boolean;
  requireCompleteRefresh?: boolean;
}): Promise<RefreshPartyRegTankStatusResult> {
  const lockKey = `party-regtank:${params.organizationId}:${params.partyId}`;
  const locked = await runExclusiveOnboardingRefresh(lockKey, async () => {
    const ids =
      typeof params.ids === "function" ? await params.ids() : params.ids;
    if (!partyHasRegTankRefreshIds(ids)) {
      throw new AppError(
        400,
        "NO_REQUEST",
        "This person has no matching RegTank record to refresh."
      );
    }
    const regTankClient = params.regTankClient ?? new RegTankAPIClient();
    const result = await syncCtosPartyRegTankStatus({
      portal: params.portal,
      organizationId: params.organizationId,
      partyKey: params.partyKey,
      individualOnboardingRequestId: ids.individualOnboardingRequestId,
      entityOnboardingRequestId: ids.entityOnboardingRequestId,
      corporateOnboardingRequestId: ids.corporateOnboardingRequestId,
      kycId: ids.kycId,
      kybId: ids.kybId,
      clearScreening: ids.confirmedScreeningAbsent === true,
      regTankClient,
      session: params.session,
      requirePersistence: params.requirePersistence,
      requireCompleteRefresh: params.requireCompleteRefresh,
    });

    if (result.refreshedSources.length === 0) {
      throw new AppError(
        502,
        "PROVIDER_REFRESH_FAILED",
        PARTY_STATUS_REFRESH_FAILED_MESSAGE
      );
    }
    logger.info(
      {
        organizationId: params.organizationId,
        partyId: params.partyId,
        portal: params.portal,
        refreshedSources: result.refreshedSources,
      },
      "Party RegTank status refreshed"
    );
    return {
      message: PARTY_STATUS_REFRESHED_MESSAGE,
      refreshedSources: result.refreshedSources,
    };
  });
  if (locked === "IN_PROGRESS") {
    throw new AppError(
      429,
      REGTANK_RATE_LIMITED_CODE,
      PARTY_STATUS_REFRESH_RECENTLY_MESSAGE
    );
  }
  return locked;
}

export async function refreshPartyRegTankStatus(
  userId: string,
  portal: Portal,
  organizationId: string,
  partyId: string,
  deps: RefreshPartyRegTankStatusDeps = {}
): Promise<RefreshPartyRegTankStatusResult> {
  const organizationService = deps.organizationService ?? new OrganizationService();
  const organization = await organizationService.getOrganization(userId, organizationId, portal);
  if (organization.type !== OrganizationType.COMPANY) {
    throw new AppError(400, "NOT_SUPPORTED", "This organisation does not have People & Access.");
  }
  const member = organization.members.find((row) => row.user_id === userId);
  const canManage =
    organization.owner_user_id === userId || member?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;
  if (!canManage) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to refresh this status");
  }

  const party = await prisma.organizationPartyProfile.findFirst({
    where:
      portal === "issuer"
        ? { id: partyId, issuer_organization_id: organizationId }
        : { id: partyId, investor_organization_id: organizationId },
    select: {
      id: true,
      party_key: true,
      origin: true,
      membership_status: true,
      identity_number: true,
    },
  });
  if (!party) {
    throw new AppError(404, "NOT_FOUND", "Party profile not found");
  }
  if (party.membership_status !== "MASTER_ACTIVE") {
    throw new AppError(400, "NOT_ALLOWED", "This person is not active on the company profile.");
  }
  if (!isLaterAddedCompanyPerson({ origin: party.origin, partyKey: party.party_key })) {
    throw new AppError(
      400,
      "NOT_ALLOWED",
      "Status refresh is only available for people added after onboarding."
    );
  }

  const entities = await organizationService.getCorporateEntities(userId, organizationId, portal);
  const person = findPersonForParty(entities.people ?? [], party.party_key, party.identity_number);
  if (!person) {
    throw new AppError(400, "NO_REQUEST", "This person has no RegTank request to refresh.");
  }

  const ids = collectPartyRegTankRefreshIds(person);
  if (!partyHasRegTankRefreshIds(ids)) {
    throw new AppError(400, "NO_REQUEST", "This person has no RegTank request to refresh.");
  }

  const kycActive = partyKycRefreshIds(ids).length > 0 && !isPartyRegTankProcessTerminal(person.onboarding?.status);
  const amlActive = partyAmlRefreshIds(ids).length > 0 && !isPartyRegTankProcessTerminal(person.screening?.status);
  if (!kycActive && !amlActive) {
    throw new AppError(400, "NO_REQUEST", "This person has no RegTank request to refresh.");
  }

  return runPartyRegTankSync({
    portal,
    organizationId,
    partyId,
    partyKey: party.party_key,
    ids: {
      individualOnboardingRequestId: kycActive
        ? ids.individualOnboardingRequestId
        : null,
      entityOnboardingRequestId: kycActive
        ? ids.entityOnboardingRequestId
        : null,
      corporateOnboardingRequestId: kycActive
        ? ids.corporateOnboardingRequestId
        : null,
      kycId: amlActive ? ids.kycId : null,
      kybId: amlActive ? ids.kybId : null,
    },
    regTankClient: deps.regTankClient,
  });
}

export async function refreshAdminPartyRegTankStatus(
  portal: Portal,
  organizationId: string,
  partyId: string,
  deps: Pick<RefreshPartyRegTankStatusDeps, "regTankClient"> = {}
): Promise<RefreshPartyRegTankStatusResult> {
  const party = await prisma.organizationPartyProfile.findFirst({
    where:
      portal === "issuer"
        ? {
            id: partyId,
            issuer_organization_id: organizationId,
            investor_organization_id: null,
          }
        : {
            id: partyId,
            investor_organization_id: organizationId,
            issuer_organization_id: null,
          },
    select: {
      id: true,
      party_key: true,
      origin: true,
      membership_status: true,
      identity_number: true,
      entity_type: true,
      name: true,
      is_director: true,
      is_shareholder: true,
    },
  });
  if (!party) throw new AppError(404, "NOT_FOUND", "Party profile not found");
  if (party.membership_status !== "MASTER_ACTIVE") {
    throw new AppError(
      400,
      "NOT_ALLOWED",
      "This person is not active on the company profile."
    );
  }
  if (!party.is_director && !party.is_shareholder) {
    throw new AppError(
      400,
      "NOT_ALLOWED",
      "Only current directors and shareholders can be synced from RegTank."
    );
  }

  const regTankClient = deps.regTankClient ?? new RegTankAPIClient();
  const session = new RegTankRefreshSession(regTankClient);

  return runPartyRegTankSync({
    portal,
    organizationId,
    partyId,
    partyKey: party.party_key,
    ids: async () => {
      try {
        return await discoverAdminRefreshIds({
          portal,
          organizationId,
          party,
          session,
        });
      } catch (error) {
        if (error instanceof AppError) throw error;
        logger.warn(
          {
            organizationId,
            partyId,
            portal,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to discover RegTank party status identifiers"
        );
        throw new AppError(
          502,
          "PROVIDER_REFRESH_FAILED",
          PARTY_STATUS_REFRESH_FAILED_MESSAGE
        );
      }
    },
    regTankClient,
    session,
    requirePersistence: true,
    requireCompleteRefresh: true,
  });
}
