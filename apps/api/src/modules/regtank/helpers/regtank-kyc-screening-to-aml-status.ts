/**
 * SECTION: RegTank KYC/DJKYC status → stored amlStatus
 * WHY: Webhooks, polls, and sync must use one mapping; "Positive Match" is a hit → review (Unresolved), not Pending
 * INPUT: Raw `status` from RegTank (e.g. "Positive Match", "No Match", "Approved")
 * OUTPUT: "Unresolved" | "Approved" | "Rejected" | "Pending"
 * WHERE USED: kyc-handler, eod-handler, aml-fetcher, aml-sync-service, guarantor AML helpers
 */
export type RegTankStoredAmlStatus = "Unresolved" | "Approved" | "Rejected" | "Pending";

export function mapRegTankKycScreeningStatusToAmlStatus(
  status: string | undefined
): RegTankStoredAmlStatus {
  if (!status) return "Pending";
  const compact = status.toUpperCase().replace(/\s+/g, "_");
  if (compact === "APPROVED" || compact === "RISK_ASSESSED") return "Approved";
  if (compact === "REJECTED" || compact === "TERMINATED") return "Rejected";
  if (
    compact === "UNRESOLVED" ||
    compact === "NO_MATCH" ||
    compact === "POSITIVE_MATCH"
  ) {
    return "Unresolved";
  }
  return "Pending";
}
