import {
  ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE,
  ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE,
  ISSUER_COMPANY_SEAL_UPLOAD_LINK_LABEL,
  ISSUER_COMPANY_SEAL_VIEW_LINK_LABEL,
  ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE,
  PROFILE_COMPANY_SEAL_HREF,
  PROFILE_PEOPLE_HREF,
} from "@cashsouk/types";
import {
  GUARANTOR_PARTIES_REQUIRED_MESSAGE,
  ISSUER_COMPANY_SEAL_STATUS_ERROR_MESSAGE,
  ISSUER_COMPANY_SEAL_STATUS_LOADING_MESSAGE,
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
  sealStatus: "uploaded" as const,
  canManageSeal: true,
};

describe("issuerOfferRepsBlocker", () => {
  it("returns null when directors, guarantors, applier, and seal file are ready", () => {
    expect(issuerOfferRepsBlocker(ready)).toBeNull();
  });

  it("skips seal checks when the package does not need a company seal", () => {
    expect(
      issuerOfferRepsBlocker({
        ...ready,
        requiresIssuerSeal: false,
        hasSealApplier: false,
        sealStatus: "idle",
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

  it("waits for seal status before treating the file as missing", () => {
    expect(issuerOfferRepsBlocker({ ...ready, sealStatus: "loading" })).toEqual({
      message: ISSUER_COMPANY_SEAL_STATUS_LOADING_MESSAGE,
      pending: true,
    });
    expect(issuerOfferRepsBlocker({ ...ready, sealStatus: "error" })?.message).toBe(
      ISSUER_COMPANY_SEAL_STATUS_ERROR_MESSAGE
    );
  });

  it("links Owner/Admin to upload and Users to Organisation status when the seal file is missing", () => {
    expect(issuerOfferRepsBlocker({ ...ready, sealStatus: "missing" })).toEqual({
      message: ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE,
      href: PROFILE_COMPANY_SEAL_HREF,
      linkLabel: ISSUER_COMPANY_SEAL_UPLOAD_LINK_LABEL,
    });
    expect(
      issuerOfferRepsBlocker({ ...ready, sealStatus: "missing", canManageSeal: false })
    ).toEqual({
      message: ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE,
      href: PROFILE_COMPANY_SEAL_HREF,
      linkLabel: ISSUER_COMPANY_SEAL_VIEW_LINK_LABEL,
    });
  });
});
