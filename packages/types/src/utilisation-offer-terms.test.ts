import {
  UTILISATION_OFFER_CONSENT_IDS,
  UTILISATION_OFFER_CONSENTS,
  UTILISATION_OFFER_TERM_CLAUSES,
  UTILISATION_OFFER_TERMS_INTRO,
  UTILISATION_OFFER_TERMS_TITLE,
  areUtilisationOfferConsentsComplete,
  parseUtilisationOfferConsentIds,
  buildUtilisationOfferConsentAcknowledgement,
  toggleUtilisationOfferConsent,
  utilisationOfferTermsPlainText,
} from "./utilisation-offer-terms";

describe("utilisation offer terms", () => {
  it("covers facility, this drawdown, digital acceptance, fees, listing, and repayment", () => {
    const titles = UTILISATION_OFFER_TERM_CLAUSES.map((clause) => clause.title);
    expect(titles).toEqual([
      "Existing facility",
      "This utilisation",
      "How you accept",
      "Fees",
      "Listing and funding",
      "Payout and repayment",
    ]);
    expect(UTILISATION_OFFER_TERMS_TITLE).toMatch(/utilisation/i);
    expect(UTILISATION_OFFER_TERMS_INTRO).toMatch(/verification code/i);
  });

  it("prints a readable plain-text pack for the offer letter", () => {
    const text = utilisationOfferTermsPlainText();
    expect(text).toContain(UTILISATION_OFFER_TERMS_TITLE);
    expect(text).toContain("Existing facility.");
    expect(text).toContain("does not need a new signature");
    expect(text).not.toMatch(/lorem ipsum/i);
    expect(text).toContain("legally binding acceptance");
    expect(text).toContain("form part of the issuer organisation");
    expect(text).not.toMatch(/Tick every confirmation/i);
    expect(text).toContain("No signature is required on this letter");
  });

  it("keeps consent ids aligned with the live statements", () => {
    expect(UTILISATION_OFFER_CONSENTS.map((consent) => consent.id)).toEqual([
      ...UTILISATION_OFFER_CONSENT_IDS,
    ]);
  });

  it("requires every consent id before acceptance is complete", () => {
    expect(areUtilisationOfferConsentsComplete([])).toBe(false);
    expect(areUtilisationOfferConsentsComplete(["terms", "authority"])).toBe(false);
    expect(areUtilisationOfferConsentsComplete([...UTILISATION_OFFER_CONSENT_IDS])).toBe(true);
    expect(parseUtilisationOfferConsentIds(["terms"])).toBeNull();
    expect(parseUtilisationOfferConsentIds(["terms", "unknown"])).toBeNull();
    expect(parseUtilisationOfferConsentIds([...UTILISATION_OFFER_CONSENT_IDS].reverse())).toEqual([
      ...UTILISATION_OFFER_CONSENT_IDS,
    ]);
    expect(areUtilisationOfferConsentsComplete([...UTILISATION_OFFER_CONSENT_IDS, "terms"])).toBe(
      false
    );
    expect(parseUtilisationOfferConsentIds([...UTILISATION_OFFER_CONSENT_IDS, "terms"])).toBeNull();
  });

  it("stores the live consent wording with the acknowledgement", () => {
    const stamped = buildUtilisationOfferConsentAcknowledgement(
      [...UTILISATION_OFFER_CONSENT_IDS],
      "2026-08-24T10:00:00.000Z"
    );
    expect(stamped?.ids).toEqual([...UTILISATION_OFFER_CONSENT_IDS]);
    expect(stamped?.acknowledged_at).toBe("2026-08-24T10:00:00.000Z");
    expect(stamped?.statements.map((row) => row.id)).toEqual([...UTILISATION_OFFER_CONSENT_IDS]);
    expect(stamped?.statements.every((row) => row.label.length > 20)).toBe(true);
    expect(buildUtilisationOfferConsentAcknowledgement(["terms"], "2026-08-24T10:00:00.000Z")).toBeNull();
  });

  it("toggles consents in stable id order", () => {
    const afterTerms = toggleUtilisationOfferConsent([], "terms", true);
    expect(afterTerms).toEqual(["terms"]);
    const afterAuthority = toggleUtilisationOfferConsent(afterTerms, "authority", true);
    expect(afterAuthority).toEqual(["terms", "authority"]);
    expect(toggleUtilisationOfferConsent(afterAuthority, "terms", false)).toEqual(["authority"]);
  });
});
