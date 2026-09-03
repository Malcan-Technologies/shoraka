import type { JsgMergeData } from "./jsg-merge.types";
import { JSG_MERGE_KEYS } from "./jsg-merge.types";
import {
  deriveFinanceDocumentsGuarantors,
  LO_MERGE_PLACEHOLDER_NAME,
  PLACEHOLDER_FINANCE_DOCUMENT_PARTY,
  visibleMergeScalar,
  visibleNric,
} from "../letter-of-offer/facility-lo-guarantors";

export type JsgRenderPayload = Record<string, unknown>;

function buildJsgCorporateBlocks(companies: JsgMergeData["guarantors_corporate"]) {
  return companies
    .filter((company) => company.name.trim())
    .map((company) => {
      const people = company.signatories
        .map((signatory) => ({ name: signatory.name.trim(), nric: signatory.nric.trim() }))
        .filter((signatory) => signatory.name.length > 0);
      const signatories =
        people.length > 0
          ? people.map((signatory) => ({
              name: signatory.name,
              nric: visibleNric(signatory.nric),
            }))
          : [{ name: LO_MERGE_PLACEHOLDER_NAME, nric: visibleNric("") }];
      return {
        company_name: visibleMergeScalar("company_name", company.name),
        company_ssm: visibleMergeScalar("company_ssm", company.ssm),
        signatories,
      };
    });
}

/** Docxtemplater payload: yellow value tags stay visible when empty; execution blocks flow. */
export function buildJsgRenderPayload(data: JsgMergeData): JsgRenderPayload {
  const corporate_guarantor_pages = buildJsgCorporateBlocks(data.guarantors_corporate);
  const hasCorporate = corporate_guarantor_pages.length > 0;

  const guarantors = data.guarantors_individual.map((guarantor) => ({
    ...guarantor,
    nric: visibleNric(guarantor.nric),
  }));

  const schedule =
    data.schedule_guarantors.length > 0
      ? data.schedule_guarantors
      : deriveFinanceDocumentsGuarantors(data);

  const scalars: Record<string, string> = {};
  for (const key of JSG_MERGE_KEYS) {
    scalars[key] = visibleMergeScalar(key, data[key]);
  }

  return {
    ...data,
    ...scalars,
    guarantors_individual: guarantors,
    schedule_guarantors: schedule.length > 0 ? schedule : [PLACEHOLDER_FINANCE_DOCUMENT_PARTY],
    corporate_guarantor_pages,
    has_individual_guarantors: guarantors.length > 0,
    has_corporate_guarantor: hasCorporate,
  };
}
