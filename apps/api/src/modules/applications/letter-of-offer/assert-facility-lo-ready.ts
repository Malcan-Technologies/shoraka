import { AppError } from "../../../lib/http/error-handler";
import type { ContractFacilityLoMergeData } from "./facility-lo-merge.types";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";

export const FACILITY_LO_DATA_INCOMPLETE = "GENERATED_DOCUMENT_DATA_INCOMPLETE";

function missingMessage(missing: string[]): string {
  if (missing.length === 1) {
    return `Letter of Offer cannot be generated: ${missing[0]}.`;
  }
  return `Letter of Offer cannot be generated. Missing: ${missing.join("; ")}.`;
}

export function assertFacilityLoMergeReady(input: {
  mergeData: ContractFacilityLoMergeData;
  sentAt: string;
  authorizedParties: AuthorizedPartiesSnapshot | null | undefined;
  liveGuarantorCount: number;
}): void {
  const missing: string[] = [];
  const data = input.mergeData;

  if (!input.sentAt.trim()) missing.push("offer send date");
  if (!data.letter_date.trim()) missing.push("letter date");
  if (!data.issuer_name.trim()) missing.push("issuer name");
  if (!data.issuer_registration_number.trim()) missing.push("issuer registration number");
  if (!data.financing_limit_rm.trim()) missing.push("financing limit");
  if (!data.tenure_days.trim()) missing.push("tenure days");
  if (!data.max_invoice_tenure_days.trim()) missing.push("maximum invoice tenure");
  if (!data.payment_period_days.trim()) missing.push("payment period");
  if (!data.sub_limit_per_invoice_rm.trim()) {
    missing.push("invoice sub-limit (configure sub_limit_per_invoice_rm on this product version)");
  }
  if (!data.part_b_financing_amount_rm.trim()) missing.push("Part B financing amount");
  if (!data.transaction_docs_days.trim()) missing.push("transaction documents deadline");
  if (!data.offer_validity_phrase.trim()) missing.push("offer validity period");

  if (!input.authorizedParties) {
    missing.push("authorised representatives (save the representatives draft before downloading)");
  }

  if (input.liveGuarantorCount > 0) {
    const mapped = data.guarantors_individual.length + data.guarantors_corporate.length;
    if (mapped === 0) missing.push("guarantors");
  }

  const corporatesWithoutReps = data.guarantors_corporate.filter(
    (company) => company.signatories.every((rep) => !rep.name.trim())
  );
  if (corporatesWithoutReps.length > 0) {
    missing.push("corporate guarantor authorised representatives");
  }

  if (missing.length === 0) return;
  throw new AppError(400, FACILITY_LO_DATA_INCOMPLETE, missingMessage(missing), { missing });
}
