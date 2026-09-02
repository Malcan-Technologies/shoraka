import { isPaymasterVerified, paymasterLinkedFinancingCount } from "@cashsouk/types";
import type { PaymasterListItem } from "@cashsouk/types";

function countNoun(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function paymasterIdentityMeta(item: PaymasterListItem): string {
  const ssm = item.registrationNumber ? `SSM: ${item.registrationNumber}` : "";
  const country = item.registrationCountry.trim();
  return [ssm, country].filter(Boolean).join(" · ");
}

export function paymasterVerificationLabel(item: Pick<PaymasterListItem, "verificationStatus">): string {
  return isPaymasterVerified(item.verificationStatus) ? "Verified" : "Unverified";
}

export function paymasterFinancingBreakdown(
  item: Pick<PaymasterListItem, "linkedFacilityCount" | "linkedNoteCount">
): string {
  return `${countNoun(item.linkedFacilityCount, "facility", "facilities")} · ${countNoun(
    item.linkedNoteCount,
    "note",
    "notes"
  )}`;
}

export { paymasterLinkedFinancingCount };
