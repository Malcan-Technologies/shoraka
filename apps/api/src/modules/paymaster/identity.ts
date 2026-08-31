/**
 * Paymaster legal identity helpers.
 * Malaysian companies are matched by SSM / registration number only — never by name.
 */

export const MALAYSIA_COUNTRY_CODE = "MY";

export function normalizeRegistrationNumber(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "");
}

export function isMalaysianSsmNumber(value: string): boolean {
  return /^\d{12}$/.test(value);
}

export function normalizeCountryCode(value: unknown): string {
  if (typeof value !== "string") return MALAYSIA_COUNTRY_CODE;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : MALAYSIA_COUNTRY_CODE;
}

export function normalizeEntityType(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeLegalName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function namesDiffer(a: string, b: string): boolean {
  return a.trim().toLowerCase() !== b.trim().toLowerCase();
}

export type PaymasterSubmittedIdentity = {
  legalName: string;
  registrationNumber: string;
  registrationCountry: string;
  entityType: string;
};

/** Registration-only parse. Country can be added later without changing name matching. */
export function parseRegistrationLookup(value: unknown): string | null {
  const registrationNumber = normalizeRegistrationNumber(value);
  return isMalaysianSsmNumber(registrationNumber) ? registrationNumber : null;
}

export function parseRelatedPartyFlag(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

export function parseSubmittedIdentity(input: {
  name?: unknown;
  ssm_number?: unknown;
  country?: unknown;
  entity_type?: unknown;
}): PaymasterSubmittedIdentity | null {
  const registrationNumber = parseRegistrationLookup(input.ssm_number);
  if (!registrationNumber) return null;
  const legalName = normalizeLegalName(input.name);
  const entityType = normalizeEntityType(input.entity_type);
  if (!legalName || !entityType) return null;
  return {
    legalName,
    registrationNumber,
    registrationCountry: normalizeCountryCode(input.country),
    entityType,
  };
}

export function submittedIdentityConflictsWithMaster(
  existing: {
    legal_name: string;
    entity_type: string;
    registration_country: string;
    registration_number: string;
  },
  submitted: PaymasterSubmittedIdentity
): boolean {
  return (
    namesDiffer(existing.legal_name, submitted.legalName) ||
    existing.entity_type.trim().toLowerCase() !== submitted.entityType.trim().toLowerCase() ||
    existing.registration_country.trim().toUpperCase() !== submitted.registrationCountry ||
    existing.registration_number !== submitted.registrationNumber
  );
}
