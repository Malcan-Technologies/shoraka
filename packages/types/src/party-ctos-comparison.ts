import type { OrganizationPartyProfileDto } from "./organization-party-profile";

/**
 * CTOS verification indicator means the current master person matches
 * the latest CTOS comparison.
 *
 * It does NOT merely mean the record originally came from CTOS.
 */
export type PartyCtosComparisonState = "MATCHED" | "DIFFERS" | "NOT_FOUND" | "NO_COMPARISON";

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

const NO_COMPARISON: PartyCtosComparison = {
  state: "NO_COMPARISON",
  label: "No CTOS comparison",
  tooltip: "No latest CTOS comparison is available for this person",
};

export function resolvePartyCtosComparison(
  party: Pick<
    OrganizationPartyProfileDto,
    "membershipStatus" | "absentFromLatestExternal" | "externalObservation" | "mismatches"
  > | null | undefined
): PartyCtosComparison {
  if (!party || party.membershipStatus === "EXTERNAL_OBSERVED") {
    return NO_COMPARISON;
  }
  if (party.absentFromLatestExternal) {
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
