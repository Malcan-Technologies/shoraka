import type {
  ApplicationPersonRow,
  ComrepProfileCompleteness,
  OrganizationPartyProfileDto,
  ProfileMissingItem,
} from "@cashsouk/types";
import { findExistingPartyForIdentityKey } from "@cashsouk/types";

export type ProfileExternalReview = {
  mismatchCount: number;
  newPartyCount: number;
  absentCount: number;
  total: number;
};

export function countProfileExternalReview(
  parties: OrganizationPartyProfileDto[] | null | undefined
): ProfileExternalReview {
  const list = parties ?? [];
  let mismatchCount = 0;
  let newPartyCount = 0;
  let absentCount = 0;
  for (const party of list) {
    if (party.membershipStatus === "EXTERNAL_OBSERVED") {
      newPartyCount += 1;
      continue;
    }
    mismatchCount += party.mismatches.length;
    if (party.membershipStatus === "MASTER_ACTIVE" && party.absentFromLatestExternal) {
      absentCount += 1;
    }
  }
  return {
    mismatchCount,
    newPartyCount,
    absentCount,
    total: mismatchCount + newPartyCount + absentCount,
  };
}

export function missingFieldsForStep(
  completeness: ComrepProfileCompleteness | null | undefined,
  step: ProfileMissingItem["step"]
): ProfileMissingItem[] {
  return (completeness?.missing ?? []).filter((item) => item.step === step);
}

export function missingFieldKeys(
  completeness: ComrepProfileCompleteness | null | undefined,
  step?: ProfileMissingItem["step"]
): Set<string> {
  const items = step ? missingFieldsForStep(completeness, step) : (completeness?.missing ?? []);
  return new Set(items.filter((item) => !item.partyKey).map((item) => item.field));
}

export type UnifiedOrgPersonKind = "master" | "external" | "inactive" | "people-only";

export type UnifiedOrgPerson = {
  key: string;
  kind: UnifiedOrgPersonKind;
  party: OrganizationPartyProfileDto | null;
  person: ApplicationPersonRow | null;
};

function partyMatchRecord(party: OrganizationPartyProfileDto): {
  partyKey: string;
  identityNumber: string | null;
} {
  return { partyKey: party.partyKey, identityNumber: party.identityNumber };
}

export function matchPersonToParty(
  person: ApplicationPersonRow,
  parties: OrganizationPartyProfileDto[]
): OrganizationPartyProfileDto | undefined {
  const identity = person.matchKey?.trim();
  if (!identity) return undefined;
  return findExistingPartyForIdentityKey(
    parties.map((party) => ({ partyKey: party.partyKey, identityNumber: party.identityNumber })),
    identity
  )
    ? parties.find((party) => {
        const hit = findExistingPartyForIdentityKey([partyMatchRecord(party)], identity);
        return Boolean(hit);
      })
    : undefined;
}

export function unifyOrganizationPeople(
  parties: OrganizationPartyProfileDto[] | null | undefined,
  people: ApplicationPersonRow[] | null | undefined
): {
  master: UnifiedOrgPerson[];
  external: UnifiedOrgPerson[];
  inactive: UnifiedOrgPerson[];
  peopleOnly: UnifiedOrgPerson[];
} {
  const partyList = parties ?? [];
  const peopleList = people ?? [];
  const matchedPeople = new Set<string>();

  const toUnified = (
    party: OrganizationPartyProfileDto,
    kind: UnifiedOrgPersonKind
  ): UnifiedOrgPerson => {
    const person =
      peopleList.find((row) => {
        if (!row.matchKey) return false;
        return Boolean(findExistingPartyForIdentityKey([partyMatchRecord(party)], row.matchKey));
      }) ?? null;
    if (person?.matchKey) matchedPeople.add(person.matchKey);
    return { key: party.id, kind, party, person };
  };

  const master = partyList
    .filter((party) => party.membershipStatus === "MASTER_ACTIVE")
    .map((party) => toUnified(party, "master"));
  const external = partyList
    .filter((party) => party.membershipStatus === "EXTERNAL_OBSERVED")
    .map((party) => toUnified(party, "external"));
  const inactive = partyList
    .filter((party) => party.membershipStatus === "MASTER_INACTIVE")
    .map((party) => toUnified(party, "inactive"));
  const peopleOnly = peopleList
    .filter((person) => person.matchKey && !matchedPeople.has(person.matchKey))
    .filter((person) => !matchPersonToParty(person, partyList))
    .map((person) => ({
      key: `people:${person.matchKey || person.name || "unknown"}`,
      kind: "people-only" as const,
      party: null,
      person,
    }));

  return { master, external, inactive, peopleOnly };
}

export function formatMasterPartyRoles(party: OrganizationPartyProfileDto): string {
  const parts: string[] = [];
  if (party.isDirector) parts.push("Director");
  if (party.isBoard) parts.push("Board");
  if (party.isManagement) parts.push("Management");
  if (party.isShareholder) {
    const pct = formatSharePercent(party.shareholdingPercentage);
    parts.push(pct ? `Shareholder ${pct}` : "Shareholder");
  }
  return parts.join(" · ") || (party.entityType === "CORPORATE" ? "Company" : "Person");
}

export function formatSharePercent(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/%/g, "").trim());
  if (!Number.isFinite(n)) return `${value}`.trim();
  const label = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${label}%`;
}

export const PARTY_MISMATCH_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  identityNumber: "Identity number",
  entityType: "Entity type",
  isDirector: "Director",
  isShareholder: "Shareholder",
  shareholdingPercentage: "Shareholding percentage",
  appointmentDate: "Appointment date",
  resignationDate: "Resignation date",
};

export function partyMismatchFieldLabel(field: string): string {
  return PARTY_MISMATCH_FIELD_LABELS[field] ?? field;
}

export function formatMismatchValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field === "shareholdingPercentage") return formatSharePercent(value as string | number) ?? String(value);
  if (field === "appointmentDate" || field === "resignationDate") {
    const raw = String(value);
    return raw.length >= 10 ? raw.slice(0, 10) : raw;
  }
  return String(value);
}

export function latestCtosLabel(party: OrganizationPartyProfileDto): string {
  if (party.membershipStatus === "EXTERNAL_OBSERVED") return "New in latest CTOS";
  if (party.absentFromLatestExternal) return "Not present in latest CTOS";
  if (party.externalObservation) return "Matched";
  return "Not yet found";
}

export function firstIncompleteProfileAnchor(
  completeness: ComrepProfileCompleteness | null | undefined,
  hasPeopleTab: boolean
): { tab: "organization" | "people"; anchor: string } | null {
  const missing = completeness?.missing ?? [];
  if (missing.length === 0) return null;
  const step = missing[0]?.step;
  const field = missing[0]?.field ?? "";
  if (step === "shareholders" || step === "board") {
    return hasPeopleTab
      ? { tab: "people", anchor: "profile-people" }
      : { tab: "organization", anchor: "profile-people" };
  }
  if (step === "financials") return { tab: "organization", anchor: "profile-financials" };
  if (step === "identity") {
    if (field === "scInvestorCategory") {
      return { tab: "organization", anchor: "profile-classification" };
    }
    if (field === "state" || field === "postalCode") {
      return { tab: "organization", anchor: "profile-address" };
    }
    if (field === "businessState" || field === "businessPostalCode") {
      return { tab: "organization", anchor: "profile-addresses" };
    }
    if (
      completeness?.organizationType === "COMPANY" &&
      (field === "name" ||
        field === "registrationNumber" ||
        field === "identityPrefix" ||
        field === "dateOfIncorporation" ||
        field === "countryOfIncorporation")
    ) {
      return { tab: "organization", anchor: "profile-company" };
    }
    return { tab: "organization", anchor: "profile-personal" };
  }
  if (step === "company") {
    if (field === "companyActivities") return { tab: "organization", anchor: "profile-about" };
    if (field.startsWith("registeredAddress") || field.startsWith("businessAddress")) {
      return { tab: "organization", anchor: "profile-addresses" };
    }
  }
  return { tab: "organization", anchor: "profile-company" };
}
