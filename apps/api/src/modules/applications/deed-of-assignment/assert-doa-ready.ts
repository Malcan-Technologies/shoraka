import { AppError } from "../../../lib/http/error-handler";
import type { DeedOfAssignmentMergeData } from "./doa-merge.types";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";

export const DOA_DATA_INCOMPLETE = "GENERATED_DOCUMENT_DATA_INCOMPLETE";

function missingMessage(missing: string[]): string {
  if (missing.length === 1) {
    return `Deed of Assignment cannot be generated: ${missing[0]}.`;
  }
  return `Deed of Assignment cannot be generated. Missing: ${missing.join("; ")}.`;
}

export function assertDeedOfAssignmentMergeReady(input: {
  mergeData: DeedOfAssignmentMergeData;
  sentAt: string;
  authorizedParties: AuthorizedPartiesSnapshot | null | undefined;
}): void {
  const missing: string[] = [];
  const data = input.mergeData;

  if (!input.sentAt.trim()) missing.push("offer send date");
  if (!data.assignment_date.trim()) missing.push("assignment date");
  if (!data.assignor_company_name.trim()) missing.push("assignor company name");
  if (!data.assignor_registration_number.trim()) missing.push("assignor registration number");

  if (!input.authorizedParties) {
    missing.push("authorised representatives (save the representatives draft before downloading)");
  } else if (!data.assignor_signatories.some((signatory) => signatory.name.trim())) {
    missing.push("issuer authorised representative");
  }

  if (missing.length === 0) return;
  throw new AppError(400, DOA_DATA_INCOMPLETE, missingMessage(missing), { missing });
}
