import type { ContractFacilityLoIndividualGuarantor } from "./facility-lo-merge.types";

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

export const FACILITY_LO_PAGE_BREAK_XML = '<w:br w:type="page"/>';

export type FacilityLoRenderPayload = Record<string, unknown>;

/** Adds docxtemplater loop helpers (conditionals + page breaks between signature pages). */
export function buildFacilityLoRenderPayload(
  data: import("./facility-lo-merge.types").ContractFacilityLoMergeData
): FacilityLoRenderPayload {
  const guarantors = data.guarantors_individual.map((guarantor, index, all) => ({
    ...guarantor,
    page_break: index < all.length - 1 ? FACILITY_LO_PAGE_BREAK_XML : "",
  }));

  return {
    ...data,
    guarantors_individual: guarantors,
    has_individual_guarantors: guarantors.length > 0,
    has_corporate_guarantor: Boolean(data.corporate_guarantor_name.trim()),
  };
}
