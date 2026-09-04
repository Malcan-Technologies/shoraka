import { AppError } from "../../../lib/http/error-handler";
import type { FacilityAgreementMergeData } from "./fa-merge.types";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";

export const FA_DATA_INCOMPLETE = "GENERATED_DOCUMENT_DATA_INCOMPLETE";

function missingMessage(missing: string[]): string {
  if (missing.length === 1) {
    return `Facility Agreement cannot be generated: ${missing[0]}.`;
  }
  return `Facility Agreement cannot be generated. Missing: ${missing.join("; ")}.`;
}

export function assertFacilityAgreementMergeReady(input: {
  mergeData: FacilityAgreementMergeData;
  sentAt: string;
  authorizedParties: AuthorizedPartiesSnapshot | null | undefined;
  liveGuarantorCount: number;
}): void {
  const missing: string[] = [];
  const data = input.mergeData;

  if (!input.sentAt.trim()) missing.push("offer send date");
  if (!data.letter_date.trim()) missing.push("letter date");
  if (!data.facility_agreement_date.trim()) missing.push("facility agreement date");
  if (!data.issuer_name.trim()) missing.push("issuer name");
  if (!data.issuer_registration_number.trim()) missing.push("issuer registration number");
  if (!data.financing_limit_rm.trim()) missing.push("financing limit");
  if (!data.facility_description.trim()) missing.push("facility description");

  if (!input.authorizedParties) {
    missing.push("authorised representatives (save the representatives draft before downloading)");
  } else if (data.issuer_signatories.every((signatory) => !signatory.name.trim())) {
    missing.push("issuer authorised representative");
  }

  if (input.liveGuarantorCount > 0) {
    const mapped = data.guarantors_individual.length + data.guarantors_corporate.length;
    if (mapped === 0) missing.push("guarantors");
  }

  const corporatesWithoutReps = data.guarantors_corporate.filter((company) =>
    company.signatories.every((rep) => !rep.name.trim())
  );
  if (corporatesWithoutReps.length > 0) {
    missing.push("corporate guarantor authorised representatives");
  }

  if (missing.length === 0) return;
  throw new AppError(400, FA_DATA_INCOMPLETE, missingMessage(missing), { missing });
}
