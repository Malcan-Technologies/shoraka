import type {
  ContractFacilityLoCorporateGuarantor,
  ContractFacilityLoCorporateSignatory,
  ContractFacilityLoIndividualGuarantor,
  ContractFacilityLoMergeData,
} from "./facility-lo-merge.types";
import {
  loCorporateAuthorizedNamesByParty,
  matchAuthorizedPartiesToGuarantors,
  type AuthorizedPartiesSnapshot,
  type AuthorizedPartyGuarantorLookup,
} from "@cashsouk/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function formatIndividualGuarantorLine(name: string, nric: string): string {
  if (!name) return "";
  return nric ? `${name} (NRIC No. ${nric})` : name;
}

export function mapIndividualGuarantors(
  guarantors: unknown
): ContractFacilityLoIndividualGuarantor[] {
  if (!Array.isArray(guarantors)) return [];

  return guarantors
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => !!entry && asString(entry.guarantor_type) === "individual")
    .map((entry) => {
      const name = asString(entry.name);
      const nric = asString(entry.ic_number);
      return {
        name,
        nric,
        line: formatIndividualGuarantorLine(name, nric),
      };
    })
    .filter((entry) => entry.name.length > 0);
}

/** Parse `guarantors_individual` from a demo generate body. */
export function parseGuarantorsFromMergeInput(input: unknown): ContractFacilityLoIndividualGuarantor[] {
  const src = asRecord(input);
  if (!src || !Array.isArray(src.guarantors_individual)) return [];

  return src.guarantors_individual
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => !!entry)
    .map((entry) => {
      const name = asString(entry.name);
      const nric = asString(entry.nric);
      const line = asString(entry.line) || formatIndividualGuarantorLine(name, nric);
      return { name, nric, line };
    })
    .filter((entry) => entry.name.length > 0);
}

function parseCorporateSignatories(value: unknown): ContractFacilityLoCorporateSignatory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return { name: entry.trim() };
      const rec = asRecord(entry);
      return rec ? { name: asString(rec.name) } : { name: "" };
    })
    .filter((entry) => entry.name.length > 0);
}

/** Parse `guarantors_corporate` from a demo generate body. */
export function parseCorporateGuarantorsFromMergeInput(
  input: unknown
): ContractFacilityLoCorporateGuarantor[] {
  const src = asRecord(input);
  if (!src || !Array.isArray(src.guarantors_corporate)) return [];

  return src.guarantors_corporate
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => !!entry)
    .map((entry) => ({
      name: asString(entry.name),
      ssm: asString(entry.ssm),
      signatories: parseCorporateSignatories(entry.signatories),
    }))
    .filter((entry) => entry.name.length > 0);
}

function guarantorRowId(entry: JsonRecord): string {
  return (
    asString(entry.id) ||
    asString(entry.reference_id) ||
    asString(entry.client_guarantor_id) ||
    asString(entry.guarantor_id)
  );
}

function companyFromRecord(entry: JsonRecord): ContractFacilityLoCorporateGuarantor | null {
  if (asString(entry.guarantor_type) !== "company") return null;
  const name = asString(entry.business_name) || asString(entry.name);
  if (!name) return null;
  return {
    name,
    ssm: asString(entry.ssm_number),
    signatories: [],
  };
}

function lookupFromRecord(entry: JsonRecord): AuthorizedPartyGuarantorLookup | null {
  const id = guarantorRowId(entry);
  if (!id) return null;
  const clientId = asString(entry.client_guarantor_id) || asString(entry.reference_id);
  const lookup: AuthorizedPartyGuarantorLookup = {
    id,
    guarantor_type: asString(entry.guarantor_type) === "company" ? "company" : "individual",
    name: asString(entry.name) || null,
    business_name: asString(entry.business_name) || null,
  };
  if (clientId) lookup.client_guarantor_id = clientId;
  return lookup;
}

/**
 * Company guarantors from application JSON, with snapshot signatories matched by id.
 * Live `application_guarantors` rows are preferred for matching when present.
 */
export function mapCorporateGuarantors(
  guarantors: unknown,
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  applicationGuarantors?: unknown
): ContractFacilityLoCorporateGuarantor[] {
  const jsonRows = Array.isArray(guarantors)
    ? guarantors.map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => !!entry)
    : [];
  const liveRows = Array.isArray(applicationGuarantors)
    ? applicationGuarantors
        .map((entry) => asRecord(entry))
        .filter((entry): entry is JsonRecord => !!entry)
    : [];

  const companyJson = jsonRows.filter((entry) => asString(entry.guarantor_type) === "company");
  const companyLive = liveRows.filter((entry) => asString(entry.guarantor_type) === "company");
  const source = companyLive.length > 0 ? companyLive : companyJson;

  const lookups: AuthorizedPartyGuarantorLookup[] = [];
  for (const entry of source) {
    const lookup = lookupFromRecord(entry);
    if (lookup) lookups.push(lookup);
  }

  const matches = matchAuthorizedPartiesToGuarantors(snapshot?.parties ?? [], lookups);
  const namesByPartyKey = new Map(
    loCorporateAuthorizedNamesByParty(snapshot).map((row) => [row.partyKey, row.names])
  );

  const namesByLookupId = new Map<string, string[]>();
  for (const [partyKey, row] of matches) {
    namesByLookupId.set(row.id, namesByPartyKey.get(partyKey) ?? []);
  }

  const companies: ContractFacilityLoCorporateGuarantor[] = [];
  for (const entry of source) {
    const company = companyFromRecord(entry);
    if (!company) continue;
    const id = guarantorRowId(entry);
    const names = id ? namesByLookupId.get(id) ?? [] : [];
    companies.push({
      ...company,
      signatories: names.map((name) => ({ name })),
    });
  }
  return companies;
}

export const FACILITY_LO_PAGE_BREAK_XML = '<w:br w:type="page"/>';
export const FACILITY_LO_CORPORATE_SIGNATORIES_PER_PAGE = 4;

export type FacilityLoCorporateSignatoryRow = {
  left: string;
  right: string;
  /** Empty-string `right` is falsy for Word — hide the second box on odd counts. */
  show_right: boolean;
};

export type FacilityLoCorporateGuarantorPage = {
  company_name: string;
  company_ssm: string;
  /** Heading + recitals + Date line print only on a company's first page. */
  is_first_page: boolean;
  signatory_rows: FacilityLoCorporateSignatoryRow[];
};

export function pairSignatoryRows(names: string[]): FacilityLoCorporateSignatoryRow[] {
  const source = names.length === 0 ? [""] : names;
  const rows: FacilityLoCorporateSignatoryRow[] = [];
  for (let i = 0; i < source.length; i += 2) {
    const left = source[i] ?? "";
    const right = source[i + 1] ?? "";
    rows.push({ left, right, show_right: right.length > 0 });
  }
  return rows;
}

/** Chunk each company's signatories into pages of up to 4 (rows of 2). */
export function buildCorporateGuarantorPages(
  companies: ContractFacilityLoCorporateGuarantor[]
): FacilityLoCorporateGuarantorPage[] {
  const rowsPerPage = FACILITY_LO_CORPORATE_SIGNATORIES_PER_PAGE / 2;
  const pages: FacilityLoCorporateGuarantorPage[] = [];

  for (const company of companies) {
    if (!company.name.trim()) continue;
    const names = company.signatories.map((s) => s.name.trim()).filter(Boolean);
    const rows = pairSignatoryRows(names);
    for (let i = 0; i < rows.length; i += rowsPerPage) {
      pages.push({
        company_name: company.name,
        company_ssm: company.ssm,
        is_first_page: i === 0,
        signatory_rows: rows.slice(i, i + rowsPerPage),
      });
    }
  }
  return pages;
}

export type FacilityLoRenderPayload = Record<string, unknown>;

/** Adds docxtemplater loop helpers (conditionals + page breaks between signature pages). */
export function buildFacilityLoRenderPayload(data: ContractFacilityLoMergeData): FacilityLoRenderPayload {
  const corporatePages = buildCorporateGuarantorPages(data.guarantors_corporate);
  const hasCorporate = corporatePages.length > 0;

  const guarantors = data.guarantors_individual.map((guarantor, index, all) => {
    const isLast = index === all.length - 1;
    const needsBreak = !isLast || hasCorporate;
    return {
      ...guarantor,
      page_break: needsBreak ? FACILITY_LO_PAGE_BREAK_XML : "",
    };
  });

  const corporate_guarantor_pages = corporatePages.map((page, index, all) => ({
    ...page,
    page_break: index < all.length - 1 ? FACILITY_LO_PAGE_BREAK_XML : "",
  }));

  return {
    ...data,
    guarantors_individual: guarantors,
    corporate_guarantor_pages,
    has_individual_guarantors: guarantors.length > 0,
    has_corporate_guarantor: hasCorporate,
  };
}
