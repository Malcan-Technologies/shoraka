/**
 * People & Access party-level RegTank refresh (later-added company people).
 * Display + ID collection only — does not change CTOS structure or company roles.
 */
import type { ApplicationPersonRow } from "./application-people-display";
import { getFinalStatusLabel } from "./director-shareholder-final-status";
import { isGeneratedUserPartyKey } from "./organization-party-key";

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
    kycId: firstPrefixed([screeningId, onboardingId], "KYC"),
    kybId: firstPrefixed([screeningId, onboardingId], "KYB"),
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
  const label = getFinalStatusLabel({ onboarding: { status } }).label;
  return label === "Approved" || label === "Completed";
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

/** Corporate People & Access KYC/KYB column — individuals still use `peopleAccessKycLabel`. */
export function peopleAccessShowsCorporateKycChip(
  person: ApplicationPersonRow | null | undefined
): boolean {
  if (!person || person.entityType !== "CORPORATE") return false;
  const label = getFinalStatusLabel(person, { displayMode: "kyc_only" }).label;
  if (label !== "Not Started") return true;
  return partyKycRefreshIds(collectPartyRegTankRefreshIds(person)).length > 0;
}

export function peopleAccessShowsCorporateAmlChip(
  person: ApplicationPersonRow | null | undefined
): boolean {
  if (!person || person.entityType !== "CORPORATE") return false;
  const label = getFinalStatusLabel({ screening: person.screening }).label;
  if (label !== "Not Started") return true;
  return partyAmlRefreshIds(collectPartyRegTankRefreshIds(person)).length > 0;
}
