import type { JsgMergeData } from "./jsg-merge.types";
import { JSG_MERGE_KEYS } from "./jsg-merge.types";
import {
  deriveFinanceDocumentsGuarantors,
  FACILITY_LO_PAGE_BREAK_XML,
  LO_MERGE_PLACEHOLDER_NAME,
  PLACEHOLDER_FINANCE_DOCUMENT_PARTY,
  visibleMergeScalar,
  visibleNric,
} from "../letter-of-offer/facility-lo-guarantors";

export type JsgRenderPayload = Record<string, unknown>;

function withGuarantorWitness<T extends Record<string, unknown>>(
  row: T,
  witnessName: string,
  witnessNric: string
): T & { witness_name: string; witness_nric: string } {
  return {
    ...row,
    witness_name: visibleMergeScalar("witness_name", witnessName),
    witness_nric: visibleNric(witnessNric),
  };
}

function buildJsgCorporateBlocks(
  companies: JsgMergeData["guarantors_corporate"],
  witnessName: string,
  witnessNric: string
) {
  return companies
    .filter((company) => company.name.trim())
    .map((company) => {
      const people = company.signatories
        .map((signatory) => ({ name: signatory.name.trim(), nric: signatory.nric.trim() }))
        .filter((signatory) => signatory.name.length > 0);
      const signatories =
        people.length > 0
          ? people.map((signatory) =>
              withGuarantorWitness(
                { name: signatory.name, nric: visibleNric(signatory.nric) },
                witnessName,
                witnessNric
              )
            )
          : [
              withGuarantorWitness(
                { name: LO_MERGE_PLACEHOLDER_NAME, nric: visibleNric("") },
                witnessName,
                witnessNric
              ),
            ];
      return {
        company_name: visibleMergeScalar("company_name", company.name),
        company_ssm: visibleMergeScalar("company_ssm", company.ssm),
        signatories,
      };
    });
}

/** Docxtemplater payload: empty optional scalars print N/A. */
export function buildJsgRenderPayload(data: JsgMergeData): JsgRenderPayload {
  const companies = buildJsgCorporateBlocks(
    data.guarantors_corporate,
    data.guarantor_witness_name,
    data.guarantor_witness_nric
  );
  const hasCorporate = companies.length > 0;

  const guarantors = data.guarantors_individual.map((guarantor) =>
    withGuarantorWitness(
      { ...guarantor, nric: visibleNric(guarantor.nric) },
      data.guarantor_witness_name,
      data.guarantor_witness_nric
    )
  );

  const schedule =
    data.schedule_guarantors.length > 0
      ? data.schedule_guarantors
      : deriveFinanceDocumentsGuarantors(data);

  const scalars: Record<string, string> = {};
  for (const key of JSG_MERGE_KEYS) {
    scalars[key] = visibleMergeScalar(key, data[key]);
  }

  const corporate_guarantor_pages = companies.map((company, index, all) => ({
    ...company,
    page_break: index < all.length - 1 ? FACILITY_LO_PAGE_BREAK_XML : "",
  }));

  return {
    ...data,
    ...scalars,
    guarantors_individual: guarantors,
    schedule_guarantors: schedule.length > 0 ? schedule : [PLACEHOLDER_FINANCE_DOCUMENT_PARTY],
    corporate_guarantor_pages,
    has_individual_guarantors: guarantors.length > 0,
    has_corporate_guarantor: hasCorporate,
    individuals_page_break:
      guarantors.length > 0 && hasCorporate ? FACILITY_LO_PAGE_BREAK_XML : "",
  };
}
