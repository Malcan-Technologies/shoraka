import {
  ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE,
  PROFILE_PEOPLE_HREF,
} from "@cashsouk/types";
import {
  GUARANTOR_PARTIES_REQUIRED_MESSAGE,
  ISSUER_DIRECTOR_IC_REQUIRED_MESSAGE,
  ISSUER_DIRECTOR_PERSON_EMAIL_REQUIRED_MESSAGE,
  ISSUER_DIRECTORS_REQUIRED_MESSAGE,
  issuerOfferRepsBlocker,
  PROFILE_PEOPLE_ACCESS_LINK_LABEL,
} from "./issuer-offer-reps-blocker";

const ready = {
  directorIssue: null,
  guarantorsReady: true,
  requiresIssuerSeal: true,
  hasSealApplier: true,
};

describe("issuerOfferRepsBlocker", () => {
  it("returns null when directors, guarantors, and applier are ready", () => {
    expect(issuerOfferRepsBlocker(ready)).toBeNull();
  });

  it("skips seal-applier checks when the package does not need a company seal", () => {
    expect(
      issuerOfferRepsBlocker({
        ...ready,
        requiresIssuerSeal: false,
        hasSealApplier: false,
      })
    ).toBeNull();
  });

  it("names the first incomplete representatives field", () => {
    expect(
      issuerOfferRepsBlocker({ ...ready, directorIssue: { kind: "none_selected" } })?.message
    ).toBe(ISSUER_DIRECTORS_REQUIRED_MESSAGE);
    expect(
      issuerOfferRepsBlocker({ ...ready, directorIssue: { kind: "missing_email" } })
    ).toEqual({
      message: ISSUER_DIRECTOR_PERSON_EMAIL_REQUIRED_MESSAGE,
      href: PROFILE_PEOPLE_HREF,
      linkLabel: PROFILE_PEOPLE_ACCESS_LINK_LABEL,
    });
    expect(
      issuerOfferRepsBlocker({ ...ready, directorIssue: { kind: "missing_ic" } })
    ).toEqual({
      message: ISSUER_DIRECTOR_IC_REQUIRED_MESSAGE,
      href: PROFILE_PEOPLE_HREF,
      linkLabel: PROFILE_PEOPLE_ACCESS_LINK_LABEL,
    });
    expect(issuerOfferRepsBlocker({ ...ready, guarantorsReady: false })?.message).toBe(
      GUARANTOR_PARTIES_REQUIRED_MESSAGE
    );
    expect(issuerOfferRepsBlocker({ ...ready, hasSealApplier: false })?.message).toBe(
      ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE
    );
  });
});
