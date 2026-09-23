import type { FacilityAgreementMergeData } from "./fa-merge.types";
import { FACILITY_AGREEMENT_MERGE_KEYS } from "./fa-merge.types";
import {
  formatCorporateGuarantorLine,
  LO_MERGE_PLACEHOLDER_INDIVIDUAL_LINE,
  visibleMergeScalar,
} from "../letter-of-offer/facility-lo-guarantors";

export type FacilityAgreementRenderPayload = Record<string, unknown>;

const PLACEHOLDER_SIGNATORY = {
  name: visibleMergeScalar("name", ""),
  designation: visibleMergeScalar("designation", ""),
  witness_name: visibleMergeScalar("witness_name", ""),
  witness_nric: visibleMergeScalar("witness_nric", ""),
};

/** Two issuer/witness pairs per ISSUER execution page. */
export const FA_ISSUER_SIGNATORIES_PER_PAGE = 2;

export const FA_PAGE_BREAK_XML = '<w:br w:type="page"/>';

export function chunkFaIssuerSignatoryPages<T>(signatories: T[]): Array<{
  issuer_signatories: T[];
  page_break: string;
}> {
  const pages: Array<{ issuer_signatories: T[]; page_break: string }> = [];
  for (let i = 0; i < signatories.length; i += FA_ISSUER_SIGNATORIES_PER_PAGE) {
    pages.push({
      issuer_signatories: signatories.slice(i, i + FA_ISSUER_SIGNATORIES_PER_PAGE),
      page_break: i + FA_ISSUER_SIGNATORIES_PER_PAGE < signatories.length ? FA_PAGE_BREAK_XML : "",
    });
  }
  return pages;
}

const PLACEHOLDER_INDIVIDUAL = {
  name: "",
  nric: "",
  line: LO_MERGE_PLACEHOLDER_INDIVIDUAL_LINE,
};

/** Docxtemplater payload: empty optional scalars print N/A. */
export function buildFacilityAgreementRenderPayload(
  data: FacilityAgreementMergeData
): FacilityAgreementRenderPayload {
  const scalars: Record<string, string> = {};
  for (const key of FACILITY_AGREEMENT_MERGE_KEYS) {
    scalars[key] = visibleMergeScalar(key, data[key]);
  }

  const individuals =
    data.guarantors_individual.length > 0
      ? data.guarantors_individual
      : [PLACEHOLDER_INDIVIDUAL];

  const corporates =
    data.guarantors_corporate.length > 0
      ? data.guarantors_corporate.map((company) => ({
          ...company,
          company_line: visibleMergeScalar(
            "company_line",
            formatCorporateGuarantorLine(company.name, company.ssm)
          ),
        }))
      : [
          {
            name: "",
            ssm: "",
            signatories: [],
            company_line: visibleMergeScalar("company_line", ""),
          },
        ];

  const signatories =
    data.issuer_signatories.length > 0
      ? data.issuer_signatories.map((signatory) => ({
          name: visibleMergeScalar("name", signatory.name),
          designation: visibleMergeScalar("designation", signatory.designation),
          witness_name: visibleMergeScalar("witness_name", signatory.witness_name),
          witness_nric: visibleMergeScalar("witness_nric", signatory.witness_nric),
        }))
      : [PLACEHOLDER_SIGNATORY];

  return {
    ...data,
    ...scalars,
    guarantors_individual: individuals.map((row) => ({
      ...row,
      line: visibleMergeScalar("line", row.line),
    })),
    guarantors_corporate: corporates,
    issuer_signatories: signatories,
    issuer_signatory_pages: chunkFaIssuerSignatoryPages(signatories),
  };
}
