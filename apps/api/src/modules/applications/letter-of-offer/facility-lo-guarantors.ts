import type {
  ContractFacilityLoCorporateGuarantor,
  ContractFacilityLoCorporateSignatory,
  ContractFacilityLoFinanceDocumentParty,
  ContractFacilityLoIndividualGuarantor,
  ContractFacilityLoMergeData,
} from "./facility-lo-merge.types";
import { CONTRACT_FACILITY_LO_MERGE_KEYS } from "./facility-lo-merge.types";
import {
  loCorporateAuthorizedRepresentativesByParty,
  matchAuthorizedPartiesToGuarantors,
  type AuthorizedPartiesSnapshot,
  type AuthorizedPartyGuarantorLookup,
  type LoCorporateAuthorizedRepresentative,
} from "@cashsouk/types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Legal-template wording shown when a merge value has no source data. */
export const LO_MERGE_PLACEHOLDER_NAME = "[INSERT NAME]";
export const LO_MERGE_PLACEHOLDER_NRIC = "[INSERT]";
export const LO_MERGE_PLACEHOLDER_INDIVIDUAL_LINE = `${LO_MERGE_PLACEHOLDER_NAME} (NRIC No. ${LO_MERGE_PLACEHOLDER_NRIC})`;

export const PLACEHOLDER_FINANCE_DOCUMENT_PARTY: ContractFacilityLoFinanceDocumentParty = {
  line: LO_MERGE_PLACEHOLDER_INDIVIDUAL_LINE,
  representatives: [],
};

export function visibleNric(nric: string): string {
  return nric.trim() || LO_MERGE_PLACEHOLDER_NRIC;
}

export function formatIndividualGuarantorLine(name: string, nric: string): string {
  const displayName = name.trim() || LO_MERGE_PLACEHOLDER_NAME;
  return `${displayName} (NRIC No. ${visibleNric(nric)})`;
}

export function formatCorporateGuarantorLine(name: string, ssm: string): string {
  const displayName = name.trim() || LO_MERGE_PLACEHOLDER_NAME;
  const displaySsm = ssm.trim() || LO_MERGE_PLACEHOLDER_NRIC;
  return `${displayName} (Registration No. ${displaySsm})`;
}

/** Empty scalars print `{field_name}` so missing merges stay visible in the Word output. */
export function visibleMergeScalar(key: string, value: string): string {
  return value.trim() ? value : `{${key}}`;
}

function representativeLines(reps: Array<{ name: string; nric: string }>): Array<{ rep_line: string }> {
  return reps
    .filter((rep) => rep.name.trim() || rep.nric.trim())
    .map((rep) => ({ rep_line: formatIndividualGuarantorLine(rep.name, rep.nric) }));
}

function liveGuarantorRows(applicationGuarantors: unknown): JsonRecord[] {
  if (!Array.isArray(applicationGuarantors)) return [];
  return applicationGuarantors
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => !!entry);
}

export function mapIndividualGuarantors(
  guarantors: unknown
): ContractFacilityLoIndividualGuarantor[] {
  return liveGuarantorRows(guarantors)
    .filter((entry) => asString(entry.guarantor_type) === "individual")
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
      if (typeof entry === "string") {
        const name = entry.trim();
        return name ? { name, nric: "", capacity: "" } : null;
      }
      const rec = asRecord(entry);
      if (!rec) return null;
      const name = asString(rec.name);
      if (!name) return null;
      return {
        name,
        nric: asString(rec.nric ?? rec.ic_number),
        capacity: asString(rec.capacity),
      };
    })
    .filter((entry): entry is ContractFacilityLoCorporateSignatory => !!entry);
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

export function parseFinanceDocumentsFromMergeInput(
  input: unknown
): ContractFacilityLoFinanceDocumentParty[] {
  const src = asRecord(input);
  if (!src || !Array.isArray(src.finance_documents_guarantors)) return [];
  return src.finance_documents_guarantors
    .map((entry) => asRecord(entry))
    .filter((entry): entry is JsonRecord => !!entry)
    .map((entry) => ({
      line: asString(entry.line),
      representatives: Array.isArray(entry.representatives)
        ? entry.representatives
            .map((rep) => asRecord(rep))
            .filter((rep): rep is JsonRecord => !!rep)
            .map((rep) => ({ rep_line: asString(rep.rep_line) }))
            .filter((rep) => rep.rep_line.length > 0)
        : [],
    }))
    .filter((entry) => entry.line.length > 0);
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

function signatoriesFromReps(
  reps: LoCorporateAuthorizedRepresentative[]
): ContractFacilityLoCorporateSignatory[] {
  return reps.map((rep) => ({
    name: rep.name,
    nric: rep.nric,
    capacity: rep.capacity,
  }));
}

function corporateSignatoriesByLiveId(
  liveRows: JsonRecord[],
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): Map<string, LoCorporateAuthorizedRepresentative[]> {
  const lookups: AuthorizedPartyGuarantorLookup[] = [];
  for (const entry of liveRows) {
    const lookup = lookupFromRecord(entry);
    if (lookup) lookups.push(lookup);
  }
  const matches = matchAuthorizedPartiesToGuarantors(snapshot?.parties ?? [], lookups);
  const repsByPartyKey = new Map(
    loCorporateAuthorizedRepresentativesByParty(snapshot).map((row) => [
      row.partyKey,
      row.representatives,
    ])
  );
  const byLookupId = new Map<string, LoCorporateAuthorizedRepresentative[]>();
  for (const [partyKey, row] of matches) {
    byLookupId.set(row.id, repsByPartyKey.get(partyKey) ?? []);
  }
  return byLookupId;
}

/**
 * Company guarantors from ordered live `application_guarantors`, with draft/canonical
 * authorised representatives matched by id.
 */
export function mapCorporateGuarantors(
  applicationGuarantors: unknown,
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): ContractFacilityLoCorporateGuarantor[] {
  const liveRows = liveGuarantorRows(applicationGuarantors);
  const repsById = corporateSignatoriesByLiveId(liveRows, snapshot);
  const companies: ContractFacilityLoCorporateGuarantor[] = [];
  for (const entry of liveRows) {
    const company = companyFromRecord(entry);
    if (!company) continue;
    const id = guarantorRowId(entry);
    const reps = id ? repsById.get(id) ?? [] : [];
    companies.push({
      ...company,
      signatories: signatoriesFromReps(reps),
    });
  }
  return companies;
}

export function mapFinanceDocumentsGuarantors(
  applicationGuarantors: unknown,
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): ContractFacilityLoFinanceDocumentParty[] {
  const liveRows = liveGuarantorRows(applicationGuarantors);
  const repsById = corporateSignatoriesByLiveId(liveRows, snapshot);
  const parties: ContractFacilityLoFinanceDocumentParty[] = [];

  for (const entry of liveRows) {
    if (asString(entry.guarantor_type) === "company") {
      const company = companyFromRecord(entry);
      if (!company) continue;
      const id = guarantorRowId(entry);
      const reps = id ? repsById.get(id) ?? [] : [];
      parties.push({
        line: formatCorporateGuarantorLine(company.name, company.ssm),
        representatives: representativeLines(reps),
      });
      continue;
    }
    if (asString(entry.guarantor_type) !== "individual") continue;
    const name = asString(entry.name);
    if (!name) continue;
    parties.push({
      line: formatIndividualGuarantorLine(name, asString(entry.ic_number)),
      representatives: [],
    });
  }
  return parties;
}

export function deriveFinanceDocumentsGuarantors(data: {
  guarantors_individual: ContractFacilityLoIndividualGuarantor[];
  guarantors_corporate: ContractFacilityLoCorporateGuarantor[];
}): ContractFacilityLoFinanceDocumentParty[] {
  return [
    ...data.guarantors_individual.map((guarantor) => ({
      line: guarantor.line || formatIndividualGuarantorLine(guarantor.name, guarantor.nric),
      representatives: [] as Array<{ rep_line: string }>,
    })),
    ...data.guarantors_corporate.map((company) => ({
      line: formatCorporateGuarantorLine(company.name, company.ssm),
      representatives: representativeLines(company.signatories),
    })),
  ].filter((entry) => entry.line.length > 0);
}

export const FACILITY_LO_PAGE_BREAK_XML = '<w:br w:type="page"/>';
export const FACILITY_LO_CORPORATE_SIGNATORIES_PER_PAGE = 4;

export type FacilityLoCorporateSignatoryRow = {
  left_name: string;
  left_nric: string;
  right_name: string;
  right_nric: string;
  /** Empty-string right is falsy for Word — hide the second box on odd counts. */
  show_right: boolean;
};

export type FacilityLoCorporateGuarantorPage = {
  company_name: string;
  company_ssm: string;
  /** Heading + recitals + Date line print only on a company's first page. */
  is_first_page: boolean;
  signatory_rows: FacilityLoCorporateSignatoryRow[];
};

export function pairSignatoryRows(
  signatories: Array<{ name: string; nric: string }>
): FacilityLoCorporateSignatoryRow[] {
  const source = signatories.length === 0 ? [{ name: "", nric: "" }] : signatories;
  const rows: FacilityLoCorporateSignatoryRow[] = [];
  for (let i = 0; i < source.length; i += 2) {
    const left = source[i] ?? { name: "", nric: "" };
    const right = source[i + 1];
    const left_name = left.name.trim() || LO_MERGE_PLACEHOLDER_NAME;
    const right_name = (right?.name ?? "").trim();
    rows.push({
      left_name,
      left_nric: visibleNric(left.nric),
      right_name,
      right_nric: right_name ? visibleNric(right?.nric ?? "") : "",
      show_right: right_name.length > 0,
    });
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
    const people = company.signatories
      .map((signatory) => ({ name: signatory.name.trim(), nric: signatory.nric.trim() }))
      .filter((signatory) => signatory.name.length > 0);
    const rows = pairSignatoryRows(people);
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
      nric: visibleNric(guarantor.nric),
      page_break: needsBreak ? FACILITY_LO_PAGE_BREAK_XML : "",
    };
  });

  const corporate_guarantor_pages = corporatePages.map((page, index, all) => ({
    ...page,
    company_name: visibleMergeScalar("company_name", page.company_name),
    company_ssm: visibleMergeScalar("company_ssm", page.company_ssm),
    page_break: index < all.length - 1 ? FACILITY_LO_PAGE_BREAK_XML : "",
  }));

  const financeDocuments =
    data.finance_documents_guarantors.length > 0
      ? data.finance_documents_guarantors
      : deriveFinanceDocumentsGuarantors(data);

  const scalars: Record<string, string> = {};
  for (const key of CONTRACT_FACILITY_LO_MERGE_KEYS) {
    const value = data[key];
    if (typeof value === "string") {
      scalars[key] = visibleMergeScalar(key, value);
    }
  }

  return {
    ...data,
    ...scalars,
    guarantors_individual: guarantors,
    finance_documents_guarantors:
      financeDocuments.length > 0 ? financeDocuments : [PLACEHOLDER_FINANCE_DOCUMENT_PARTY],
    corporate_guarantor_pages,
    has_individual_guarantors: guarantors.length > 0,
    has_corporate_guarantor: hasCorporate,
  };
}
