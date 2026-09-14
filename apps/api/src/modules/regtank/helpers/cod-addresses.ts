/**
 * Maps RegTank COD Basic Information address fields into registered vs business
 * addresses. Postcode must come from the postal-code field, never from line1/state.
 */

export type CodAddress = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
};

export type CodAddresses = {
  business: CodAddress;
  registered: CodAddress;
};

type CodField = { fieldName?: unknown; fieldValue?: unknown };

function asText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function fieldName(row: CodField): string {
  return typeof row.fieldName === "string" ? row.fieldName.trim() : "";
}

function isHeader(row: CodField): boolean {
  return String((row as { fieldType?: unknown }).fieldType ?? "").trim().toLowerCase() === "header";
}

function findExact(content: CodField[], names: readonly string[]): string | null {
  const wanted = new Set(names.map((name) => name.trim().toLowerCase()));
  for (const row of content) {
    if (isHeader(row)) continue;
    if (!wanted.has(fieldName(row).toLowerCase())) continue;
    const value = asText(row.fieldValue);
    if (value) return value;
  }
  return null;
}

function address(params: {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
}): CodAddress {
  return {
    line1: params.line1,
    line2: params.line2,
    city: params.city,
    postalCode: params.postalCode,
    state: params.state,
    country: params.country,
  };
}

/** Business / operating address uses the unqualified Address / Postal code fields. */
const BUSINESS_LINE1 = ["Address (line 1)", "Address line 1", "Address"] as const;
const BUSINESS_LINE2 = ["Address (line 2)", "Address line 2"] as const;
const BUSINESS_CITY = ["City"] as const;
const BUSINESS_POSTCODE = ["Postal code", "Postal Code", "Postcode"] as const;
const BUSINESS_STATE = ["State"] as const;
const BUSINESS_COUNTRY = ["Country"] as const;

/** Registered address uses qualified field names only — never the section header "Registered Address". */
const REGISTERED_LINE1 = [
  "Address line 1 (Registered Address)",
  "Registered Address line 1",
] as const;
const REGISTERED_LINE2 = [
  "Address line 2 (Registered Address)",
  "Registered Address line 2",
] as const;
const REGISTERED_CITY = ["City (Registered Address)"] as const;
const REGISTERED_POSTCODE = [
  "Postal code (Registered Address)",
  "Postal Code (Registered Address)",
  "Postcode (Registered Address)",
] as const;
const REGISTERED_STATE = ["State (Registered Address)"] as const;
const REGISTERED_COUNTRY = ["Country (Registered Address)"] as const;

export function parseRegTankCodAddresses(basicContent: unknown): CodAddresses {
  const content = Array.isArray(basicContent) ? (basicContent as CodField[]) : [];
  return {
    business: address({
      line1: findExact(content, BUSINESS_LINE1),
      line2: findExact(content, BUSINESS_LINE2),
      city: findExact(content, BUSINESS_CITY),
      postalCode: findExact(content, BUSINESS_POSTCODE),
      state: findExact(content, BUSINESS_STATE),
      country: findExact(content, BUSINESS_COUNTRY),
    }),
    registered: address({
      line1: findExact(content, REGISTERED_LINE1),
      line2: findExact(content, REGISTERED_LINE2),
      city: findExact(content, REGISTERED_CITY),
      postalCode: findExact(content, REGISTERED_POSTCODE),
      state: findExact(content, REGISTERED_STATE),
      country: findExact(content, REGISTERED_COUNTRY),
    }),
  };
}
