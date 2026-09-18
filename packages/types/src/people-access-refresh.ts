/**
 * People & Access party-level RegTank refresh (later-added company people).
 * Display + ID collection only — does not change CTOS structure or company roles.
 */
import type { ApplicationPersonRow } from "./application-people-display";
import { getFinalStatusLabel } from "./director-shareholder-final-status";
import { isGeneratedUserPartyKey } from "./organization-party-key";
import { isIndividualKycReference } from "./regtank-individual-kyc-reference";

export type PartyRegTankRefreshIds = {
  individualOnboardingRequestId: string | null;
  entityOnboardingRequestId: string | null;
  corporateOnboardingRequestId: string | null;
  kycId: string | null;
  kybId: string | null;
};

function trimId(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function firstPrefixed(
  candidates: Array<string | null | undefined>,
  prefix: string
): string | null {
  for (const candidate of candidates) {
    const id = trimId(candidate);
    if (id.startsWith(prefix)) return id;
  }
  return null;
}

function isCorporateKybReference(id: string): boolean {
  const upper = id.toUpperCase();
  return upper.startsWith("DJKYB") || upper.startsWith("KYB");
}

/**
 * Later-added company person: Add company person (`USER_ADDED`) or generated `user:` key.
 * Initial CTOS / RegTank onboarding parties are excluded.
 */
export function isLaterAddedCompanyPerson(params: {
  origin?: string | null;
  partyKey?: string | null;
}): boolean {
  const key = String(params.partyKey ?? "").trim();
  if (key && isGeneratedUserPartyKey(key)) return true;
  return String(params.origin ?? "").trim().toUpperCase() === "USER_ADDED";
}

export function collectPartyRegTankRefreshIds(
  person: Pick<
    ApplicationPersonRow,
    | "onboarding"
    | "requestId"
    | "directorEodRequestId"
    | "shareholderEodRequestId"
    | "partyCorporateRequestId"
    | "screeningRequestId"
    | "screening"
  >
): PartyRegTankRefreshIds {
  const onboardingId = person.onboarding?.id;
  const requestId = person.requestId;
  const screeningId = person.screeningRequestId ?? person.screening?.id;
  return {
    individualOnboardingRequestId: firstPrefixed(
      [onboardingId, requestId, person.directorEodRequestId, person.shareholderEodRequestId],
      "LD"
    ),
    entityOnboardingRequestId: firstPrefixed(
      [onboardingId, requestId, person.directorEodRequestId, person.shareholderEodRequestId],
      "EOD"
    ),
    corporateOnboardingRequestId: firstPrefixed(
      [person.partyCorporateRequestId, onboardingId, requestId],
      "COD"
    ),
    kycId: (() => {
      // Individual KYC can be returned as "KYC..." (Acuris) or "DJKYC..." (Dow Jones).
      for (const candidate of [screeningId, onboardingId]) {
        const id = trimId(candidate);
        if (isIndividualKycReference(id)) return id;
      }
      return null;
    })(),
    kybId: (() => {
      for (const candidate of [screeningId, onboardingId]) {
        const id = trimId(candidate);
        if (isCorporateKybReference(id)) return id;
      }
      return null;
    })(),
  };
}

export function partyHasRegTankRefreshIds(ids: PartyRegTankRefreshIds): boolean {
  return Boolean(
    ids.individualOnboardingRequestId ||
      ids.entityOnboardingRequestId ||
      ids.corporateOnboardingRequestId ||
      ids.kycId ||
      ids.kybId
  );
}

/** Approved / Completed — hide the compact refresh control for that process. */
export function isPartyRegTankProcessTerminal(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toUpperCase();
  if (!s) return false;
  return s === "APPROVED" || s === "COMPLETED" || s === "AML_APPROVED" || s === "CLEAR";
}

export function partyKycRefreshIds(ids: PartyRegTankRefreshIds): string[] {
  return [
    ids.individualOnboardingRequestId,
    ids.entityOnboardingRequestId,
    ids.corporateOnboardingRequestId,
  ].filter((id): id is string => Boolean(id));
}

export function partyAmlRefreshIds(ids: PartyRegTankRefreshIds): string[] {
  return [ids.kycId, ids.kybId].filter((id): id is string => Boolean(id));
}

export function shouldShowPartyKycRefresh(params: {
  person: ApplicationPersonRow | null | undefined;
  origin?: string | null;
  partyKey?: string | null;
  kind?: string | null;
}): boolean {
  if (params.kind && params.kind !== "company_person") return false;
  if (!isLaterAddedCompanyPerson({ origin: params.origin, partyKey: params.partyKey })) return false;
  if (!params.person) return false;
  const ids = collectPartyRegTankRefreshIds(params.person);
  if (partyKycRefreshIds(ids).length === 0) return false;
  return !isPartyRegTankProcessTerminal(params.person.onboarding?.status);
}

export function shouldShowPartyAmlRefresh(params: {
  person: ApplicationPersonRow | null | undefined;
  origin?: string | null;
  partyKey?: string | null;
  kind?: string | null;
}): boolean {
  if (params.kind && params.kind !== "company_person") return false;
  if (!isLaterAddedCompanyPerson({ origin: params.origin, partyKey: params.partyKey })) return false;
  if (!params.person) return false;
  const ids = collectPartyRegTankRefreshIds(params.person);
  if (partyAmlRefreshIds(ids).length === 0) return false;
  return !isPartyRegTankProcessTerminal(params.person.screening?.status);
}

export function peopleAccessIsCorporateEntity(
  entityType: string | null | undefined
): boolean {
  return String(entityType ?? "").trim().toUpperCase() === "CORPORATE";
}

/** Party entity type wins so Investor/Admin chips match for the same company person. */
export function peopleAccessStatusEntityType(params: {
  entityType?: string | null;
  party?: { entityType?: string | null } | null;
  person?: { entityType?: string | null } | null;
}): string | null {
  return params.entityType ?? params.party?.entityType ?? params.person?.entityType ?? null;
}

/** Corporate People & Access KYC/KYB column — individuals still use `peopleAccessKycLabel`. */
export function peopleAccessShowsCorporateKycChip(
  person: ApplicationPersonRow | null | undefined,
  entityType?: string | null
): boolean {
  if (!person) return false;
  if (!peopleAccessIsCorporateEntity(entityType ?? person.entityType)) return false;
  const label = getFinalStatusLabel(person, { displayMode: "kyc_only" }).label;
  if (label !== "Not Started") return true;
  return partyKycRefreshIds(collectPartyRegTankRefreshIds(person)).length > 0;
}

export function peopleAccessShowsCorporateAmlChip(
  person: ApplicationPersonRow | null | undefined,
  entityType?: string | null
): boolean {
  if (!person) return false;
  if (!peopleAccessIsCorporateEntity(entityType ?? person.entityType)) return false;
  const label = getFinalStatusLabel({ screening: person.screening }).label;
  if (label !== "Not Started") return true;
  return partyAmlRefreshIds(collectPartyRegTankRefreshIds(person)).length > 0;
}
