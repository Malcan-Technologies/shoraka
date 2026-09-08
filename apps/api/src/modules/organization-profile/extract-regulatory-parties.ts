/**
 * Regulatory party candidates for CashSouk master profile seeding.
 * Includes every CTOS shareholder (no 5% filter). Does not copy country from
 * registered-address country or CTOS equity into units/amount.
 */

import {
  extractBusinessNameFromRegTankForm,
  extractBusinessNumber,
  extractGovernmentId,
  extractPercentOfSharesFromRegTankForm,
  normalizeDirectorShareholderIdKey,
} from "@cashsouk/types";
import { ctosPositionDirectorShareholderFlags } from "../regtank/helpers/ctos-position-roles";

export type RegulatoryPartyCandidate = {
  partyKey: string;
  origin: "CTOS_PARTY" | "REGTANK_PARTY";
  entityType: "INDIVIDUAL" | "CORPORATE";
  name: string | null;
  identityNumber: string | null;
  identityPrefix: "NRIC" | "PASSPORT" | "ROC" | null;
  isDirector: boolean;
  isShareholder: boolean;
  isBoard: boolean;
  shareholdingPercentage: number | null;
  addressLine1: string | null;
  appointmentDate: string | null;
  resignationDate: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePercent(value: unknown): number | null {
  const raw =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : null;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw > 0 && raw <= 1) return raw * 100;
  return raw;
}

function ctosPartyKey(row: Record<string, unknown>): string | null {
  const partyType = asText(row.party_type)?.toUpperCase() ?? "";
  if (partyType === "I") {
    return normalizeDirectorShareholderIdKey(asText(row.nic_brno));
  }
  if (partyType === "C") {
    return normalizeDirectorShareholderIdKey(asText(row.ic_lcno) ?? asText(row.brn_ssm));
  }
  return (
    normalizeDirectorShareholderIdKey(asText(row.nic_brno)) ??
    normalizeDirectorShareholderIdKey(asText(row.ic_lcno)) ??
    normalizeDirectorShareholderIdKey(asText(row.brn_ssm))
  );
}

function ctosEntityType(row: Record<string, unknown>): "INDIVIDUAL" | "CORPORATE" | null {
  const partyType = asText(row.party_type)?.toUpperCase() ?? "";
  if (partyType === "I") return "INDIVIDUAL";
  if (partyType === "C") return "CORPORATE";
  return null;
}

function displayName(row: Record<string, unknown>): string | null {
  return (
    asText(row.name) ??
    asText(row.fullName) ??
    asText(row.businessName) ??
    asText(row.companyName)
  );
}

function inferIndividualIdentityPrefix(id: string | null): "NRIC" | "PASSPORT" | null {
  if (!id) return null;
  const compact = id.replace(/[^A-Za-z0-9]/g, "");
  if (/^\d{12}$/.test(compact)) return "NRIC";
  return compact.length > 0 ? "PASSPORT" : null;
}

function mergeCandidate(
  map: Map<string, RegulatoryPartyCandidate>,
  next: RegulatoryPartyCandidate
): void {
  const existing = map.get(next.partyKey);
  if (!existing) {
    map.set(next.partyKey, next);
    return;
  }
  existing.isDirector = existing.isDirector || next.isDirector;
  existing.isShareholder = existing.isShareholder || next.isShareholder;
  existing.isBoard = existing.isBoard || next.isBoard;
  existing.name = existing.name ?? next.name;
  existing.identityNumber = existing.identityNumber ?? next.identityNumber;
  existing.identityPrefix = existing.identityPrefix ?? next.identityPrefix;
  if (next.origin === "REGTANK_PARTY" && next.shareholdingPercentage != null) {
    existing.shareholdingPercentage = next.shareholdingPercentage;
  } else {
    existing.shareholdingPercentage = existing.shareholdingPercentage ?? next.shareholdingPercentage;
  }
  existing.addressLine1 = existing.addressLine1 ?? next.addressLine1;
  existing.appointmentDate = existing.appointmentDate ?? next.appointmentDate;
  existing.resignationDate = existing.resignationDate ?? next.resignationDate;
}

/** Merge CTOS + RegTank candidates. Same identity keeps both director and shareholder roles. */
export function mergeRegulatoryPartyCandidates(
  fromCtos: RegulatoryPartyCandidate[],
  fromRegtank: RegulatoryPartyCandidate[]
): RegulatoryPartyCandidate[] {
  const map = new Map<string, RegulatoryPartyCandidate>();
  for (const party of fromCtos) mergeCandidate(map, { ...party });
  for (const party of fromRegtank) mergeCandidate(map, { ...party });
  return [...map.values()];
}

export function extractRegulatoryPartiesFromCtos(ctos: unknown): RegulatoryPartyCandidate[] {
  if (!isObject(ctos)) return [];
  const map = new Map<string, RegulatoryPartyCandidate>();

  const pushRow = (
    row: Record<string, unknown>,
    roles: { isDirector: boolean; isShareholder: boolean }
  ): void => {
    const entityType = ctosEntityType(row);
    const partyKey = ctosPartyKey(row);
    if (!entityType || !partyKey) return;
    if (!roles.isDirector && !roles.isShareholder) return;
    mergeCandidate(map, {
      partyKey,
      origin: "CTOS_PARTY",
      entityType,
      name: displayName(row),
      identityNumber:
        entityType === "INDIVIDUAL"
          ? asText(row.nic_brno)
          : asText(row.ic_lcno) ?? asText(row.brn_ssm),
      identityPrefix:
        entityType === "CORPORATE"
          ? "ROC"
          : inferIndividualIdentityPrefix(asText(row.nic_brno)),
      isDirector: roles.isDirector,
      isShareholder: roles.isShareholder,
      isBoard: false,
      shareholdingPercentage: roles.isShareholder ? parsePercent(row.equity_percentage) : null,
      addressLine1: asText(row.addr),
      appointmentDate: asText(row.appoint),
      resignationDate: asText(row.resign_date),
    });
  };

  for (const d of asArray(ctos.directors)) {
    if (!isObject(d)) continue;
    const flags = ctosPositionDirectorShareholderFlags(asText(d.position));
    pushRow(d, flags);
  }

  for (const s of asArray(ctos.shareholders)) {
    if (!isObject(s)) continue;
    pushRow(s, { isDirector: false, isShareholder: true });
  }

  return [...map.values()];
}

function personalName(info: Record<string, unknown> | null): string | null {
  if (!info) return null;
  const full = asText(info.fullName);
  if (full) return full;
  const parts = [asText(info.firstName), asText(info.middleName), asText(info.lastName)].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(" ") : null;
}

export function extractRegulatoryPartiesFromCorporateEntities(
  corporateEntities: unknown
): RegulatoryPartyCandidate[] {
  if (!isObject(corporateEntities)) return [];
  const map = new Map<string, RegulatoryPartyCandidate>();

  const pushIndividual = (
    row: Record<string, unknown>,
    roles: { isDirector: boolean; isShareholder: boolean }
  ): void => {
    const info = isObject(row.personalInfo) ? row.personalInfo : null;
    const formContent = info?.formContent ?? row.formContent;
    const id = asText(info?.governmentIdNumber) ?? extractGovernmentId(formContent);
    const partyKey = normalizeDirectorShareholderIdKey(id);
    if (!partyKey) return;
    mergeCandidate(map, {
      partyKey,
      origin: "REGTANK_PARTY",
      entityType: "INDIVIDUAL",
      name: personalName(info),
      identityNumber: id,
      identityPrefix: inferIndividualIdentityPrefix(id),
      isDirector: roles.isDirector,
      isShareholder: roles.isShareholder,
      isBoard: false,
      shareholdingPercentage:
        parsePercent(row.sharePercentage ?? row.ownershipPercentage) ??
        extractPercentOfSharesFromRegTankForm(formContent),
      addressLine1: null,
      appointmentDate: null,
      resignationDate: null,
    });
  };

  for (const d of asArray(corporateEntities.directors)) {
    if (!isObject(d)) continue;
    pushIndividual(d, { isDirector: true, isShareholder: false });
  }
  for (const s of asArray(corporateEntities.shareholders)) {
    if (!isObject(s)) continue;
    pushIndividual(s, { isDirector: false, isShareholder: true });
  }
  for (const c of asArray(corporateEntities.corporateShareholders)) {
    if (!isObject(c)) continue;
    const formContent = c.formContent;
    const ssm =
      asText(c.ssmRegistrationNumber) ??
      asText(c.ssmRegisterNumber) ??
      asText(c.registrationNumber) ??
      asText(c.brn) ??
      extractBusinessNumber(formContent);
    const partyKey = normalizeDirectorShareholderIdKey(ssm);
    if (!partyKey) continue;
    mergeCandidate(map, {
      partyKey,
      origin: "REGTANK_PARTY",
      entityType: "CORPORATE",
      name:
        asText(c.businessName) ??
        asText(c.name) ??
        asText(c.companyName) ??
        extractBusinessNameFromRegTankForm(formContent),
      identityNumber: ssm,
      identityPrefix: "ROC",
      isDirector: false,
      isShareholder: true,
      isBoard: false,
      shareholdingPercentage:
        parsePercent(c.sharePercentage ?? c.ownershipPercentage) ??
        extractPercentOfSharesFromRegTankForm(formContent),
      addressLine1: null,
      appointmentDate: null,
      resignationDate: null,
    });
  }

  return [...map.values()];
}

export function extractCtosObservationSnapshot(ctos: unknown): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const party of extractRegulatoryPartiesFromCtos(ctos)) {
    map.set(party.partyKey, {
      name: party.name,
      identityNumber: party.identityNumber,
      entityType: party.entityType,
      isDirector: party.isDirector,
      isShareholder: party.isShareholder,
      shareholdingPercentage: party.shareholdingPercentage,
      addressLine1: party.addressLine1,
      appointmentDate: party.appointmentDate,
      resignationDate: party.resignationDate,
    });
  }
  return map;
}
