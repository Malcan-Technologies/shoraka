import {
  CTOS_ABSENCE_ACK_FINGERPRINT_KEY,
  ctosExtractFingerprint,
  isUnusableCtosCompanyExtract,
  partyNeedsCtosAbsenceReview,
} from "./ctos-company-extract";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import { emptyPartyPlatformFields } from "./organization-party-profile";

function party(
  overrides: Partial<OrganizationPartyProfileDto>
): Pick<
  OrganizationPartyProfileDto,
  | "membershipStatus"
  | "absentFromLatestExternal"
  | "externalObservation"
  | "ctosAbsenceAckFingerprint"
  | "ctosExtractUnusable"
  | "ctosAbsenceReviewNeeded"
> {
  return {
    membershipStatus: "MASTER_ACTIVE",
    absentFromLatestExternal: true,
    externalObservation: null,
    ...emptyPartyPlatformFields(),
    ...overrides,
  };
}

describe("ctos company extract", () => {
  it("treats empty directors/shareholders as unusable", () => {
    expect(isUnusableCtosCompanyExtract({ directors: [], shareholders: [] })).toBe(true);
    expect(isUnusableCtosCompanyExtract(null)).toBe(true);
    expect(ctosExtractFingerprint({ directors: [], shareholders: [] })).toBe("unusable");
  });

  it("treats a matchable director as usable", () => {
    const ctos = { directors: [{ nic_brno: "891114075601", name: "Ivan" }], shareholders: [] };
    expect(isUnusableCtosCompanyExtract(ctos)).toBe(false);
    expect(ctosExtractFingerprint(ctos)).toContain("891114075601");
  });

  it("does not ask for absence review when the extract is unusable", () => {
    expect(
      partyNeedsCtosAbsenceReview(party({}), { directors: [], shareholders: [] })
    ).toBe(false);
    expect(partyNeedsCtosAbsenceReview(party({ ctosExtractUnusable: true }))).toBe(false);
  });

  it("clears absence review after the current extract is acknowledged", () => {
    const ctos = { directors: [{ nic_brno: "800101011234", name: "Jamie" }] };
    const fingerprint = ctosExtractFingerprint(ctos);
    expect(
      partyNeedsCtosAbsenceReview(
        party({
          externalObservation: { [CTOS_ABSENCE_ACK_FINGERPRINT_KEY]: fingerprint },
        }),
        ctos
      )
    ).toBe(false);
    expect(
      partyNeedsCtosAbsenceReview(
        party({
          externalObservation: { [CTOS_ABSENCE_ACK_FINGERPRINT_KEY]: fingerprint },
        }),
        { directors: [{ nic_brno: "900101101234", name: "Other" }] }
      )
    ).toBe(true);
  });
});
