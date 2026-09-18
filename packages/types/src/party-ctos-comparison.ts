import { isUnusableCtosCompanyExtract, partyNeedsCtosAbsenceReview } from "./ctos-company-extract";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";

/**
 * CTOS verification indicator means the current master person matches
 * the latest CTOS comparison.
 *
 * It does NOT merely mean the record originally came from CTOS.
 */
export type PartyCtosComparisonState =
  | "MATCHED"
  | "DIFFERS"
  | "NOT_FOUND"
  | "ACKNOWLEDGED"
  | "NO_COMPARISON";

export type PartyCtosComparison = {
  state: PartyCtosComparisonState;
  label: string;
  tooltip: string;
};

const MATCHED: PartyCtosComparison = {
  state: "MATCHED",
  label: "CTOS matched",
  tooltip: "Verified against latest CTOS information",
};

const DIFFERS: PartyCtosComparison = {
  state: "DIFFERS",
  label: "CTOS differs",
  tooltip: "Latest CTOS information differs from the current profile",
};

const NOT_FOUND: PartyCtosComparison = {
  state: "NOT_FOUND",
  label: "Not found in latest CTOS",
  tooltip: "This person was not found in the latest CTOS information",
};

const ACKNOWLEDGED: PartyCtosComparison = {
  state: "ACKNOWLEDGED",
  label: "Current profile",
  tooltip: "Kept on the current profile. Review again if CTOS information changes.",
};

const NO_COMPARISON: PartyCtosComparison = {
  state: "NO_COMPARISON",
  label: "No CTOS comparison",
  tooltip: "No latest CTOS comparison is available for this person",
};

export function resolvePartyCtosComparison(
  party: Pick<
    OrganizationPartyProfileDto,
    | "membershipStatus"
    | "absentFromLatestExternal"
    | "externalObservation"
    | "mismatches"
    | "ctosAbsenceAckFingerprint"
    | "ctosExtractUnusable"
    | "ctosAbsenceReviewNeeded"
  > | null | undefined,
  latestCtos?: unknown
): PartyCtosComparison {
  if (!party || party.membershipStatus === "EXTERNAL_OBSERVED") {
    return NO_COMPARISON;
  }
  if (party.absentFromLatestExternal) {
    if (party.ctosExtractUnusable || (latestCtos !== undefined && isUnusableCtosCompanyExtract(latestCtos))) {
      return NO_COMPARISON;
    }
    if (!partyNeedsCtosAbsenceReview(party, latestCtos)) return ACKNOWLEDGED;
    return NOT_FOUND;
  }
  if ((party.mismatches?.length ?? 0) > 0) {
    return DIFFERS;
  }
  if (party.externalObservation) {
    return MATCHED;
  }
  return NO_COMPARISON;
}
