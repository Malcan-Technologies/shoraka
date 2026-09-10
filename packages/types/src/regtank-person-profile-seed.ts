import { parseComrepCalendarDate } from "./comrep-profile";
import { isScAppendixACountry } from "./sc-appendix-a-countries";

export type RegTankPersonSeedFields = {
  name: string | null;
  identityNumber: string | null;
  identityPrefix: "PASSPORT" | null;
  gender: "MALE" | "FEMALE" | null;
  dateOfBirth: string | null;
  nationality: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function userProfileFromQuery(details: unknown): Record<string, unknown> {
  if (!isObject(details)) return {};
  const nested = details.userProfile;
  return isObject(nested) ? nested : details;
}

function firstText(sources: Array<Record<string, unknown>>, keys: string[]): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = text(source[key]);
      if (value) return value;
    }
  }
  return null;
}

function mapPassportPrefix(raw: string | null): "PASSPORT" | null {
  if (!raw) return null;
  return raw.trim().toUpperCase() === "PASSPORT" ? "PASSPORT" : null;
}

function mapGender(raw: string | null): "MALE" | "FEMALE" | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (upper === "MALE") return "MALE";
  if (upper === "FEMALE") return "FEMALE";
  return null;
}

function mapNationality(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (isScAppendixACountry(trimmed)) return trimmed;
  const upper = trimmed.toUpperCase();
  if (isScAppendixACountry(upper)) return upper;
  return null;
}

function mapName(profile: Record<string, unknown>): string | null {
  const full = text(profile.name) ?? text(profile.fullName) ?? text(profile.legalName);
  if (full) return full;
  const parts = [profile.firstName, profile.middleName, profile.lastName]
    .map((part) => text(part))
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" ") : null;
}

/**
 * Confirmed RegTank individual-query fields for fill-empty OPP seed.
 * Does not include email, address, phone, roles, or share fields.
 */
export function extractRegTankPersonSeedFields(details: unknown): RegTankPersonSeedFields {
  const root = isObject(details) ? details : {};
  const profile = userProfileFromQuery(details);
  const sources = [profile, root];
  const dobRaw =
    firstText(sources, ["dateOfBirth", "date_of_birth", "dob"]) ??
    (profile.dateOfBirth instanceof Date ? profile.dateOfBirth.toISOString() : null);
  const parsedDob = parseComrepCalendarDate(dobRaw);
  return {
    name: mapName(profile) ?? mapName(root),
    identityNumber:
      firstText(sources, ["documentNum", "documentNumber", "governmentIdNumber", "idNumber"]) ?? null,
    identityPrefix: mapPassportPrefix(firstText(sources, ["documentType", "idType"])),
    gender: mapGender(firstText(sources, ["gender"])),
    dateOfBirth: parsedDob ? parsedDob.toISOString().slice(0, 10) : null,
    nationality: mapNationality(firstText(sources, ["nationality"])),
  };
}
