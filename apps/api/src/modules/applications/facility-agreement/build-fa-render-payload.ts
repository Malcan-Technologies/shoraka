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
};

const PLACEHOLDER_INDIVIDUAL = {
  name: "",
  nric: "",
  line: LO_MERGE_PLACEHOLDER_INDIVIDUAL_LINE,
};

/** Docxtemplater payload: yellow value tags stay visible when empty. */
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
  };
}
