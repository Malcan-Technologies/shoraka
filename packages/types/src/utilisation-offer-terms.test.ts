import {
  UTILISATION_FULL_AUTHORISATION_CLAUSES,
  UTILISATION_FULL_AUTHORISATION_TITLE,
  UTILISATION_FULL_AUTHORISATION_VERSION,
  UTILISATION_OFFER_BINDING_FOOTER,
  UTILISATION_OFFER_CONSENTS_INTRO,
  UTILISATION_OFFER_CONSENT_IDS,
  UTILISATION_OFFER_CONSENTS,
  UTILISATION_OFFER_TERM_CLAUSES,
  UTILISATION_OFFER_TERMS_INTRO,
  UTILISATION_OFFER_TERMS_READ_LINK,
  UTILISATION_OFFER_TERMS_TITLE,
  UTILISATION_OFFER_VISIBLE_CONSENT_IDS,
  areUtilisationOfferConsentsComplete,
  parseUtilisationOfferConsentIds,
  buildUtilisationOfferConsentAcknowledgement,
  computeIndicativeAmountPayable,
  computeIndicativeUtilisationProfit,
  confirmUtilisationFullAuthorisation,
  toggleUtilisationOfferConsent,
  utilisationOfferAcceptBlockedReason,
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
    expect(UTILISATION_OFFER_TERMS_READ_LINK).toMatch(/Read utilisation terms/i);
  });

  it("prints a readable plain-text pack for the offer letter", () => {
    const text = utilisationOfferTermsPlainText();
    expect(text).toContain(UTILISATION_OFFER_TERMS_TITLE);
    expect(text).toContain("Existing facility.");
    expect(text).toContain("does not need a new signature");
    expect(text).not.toMatch(/lorem ipsum/i);
    expect(text).toContain("I confirm and accept the transaction details");
    expect(text).toContain(UTILISATION_OFFER_BINDING_FOOTER);
    expect(text).toContain(UTILISATION_FULL_AUTHORISATION_TITLE);
    expect(text).toContain("Clause 3A.4");
    expect(text).toContain("form part of the issuer organisation");
    expect(text).not.toMatch(/Tick every confirmation/i);
    expect(text).toContain("No signature is required on this letter");
  });

  it("keeps visible consent ids aligned with the live statements", () => {
    expect(UTILISATION_OFFER_CONSENTS.map((consent) => consent.id)).toEqual([
      ...UTILISATION_OFFER_VISIBLE_CONSENT_IDS,
    ]);
    expect(UTILISATION_OFFER_CONSENT_IDS).toEqual([
      "transaction_details",
      "digital_authorisation",
      "full_authorisation",
    ]);
  });

  it("requires both confirmations and the full authorisation before acceptance is complete", () => {
    expect(areUtilisationOfferConsentsComplete([])).toBe(false);
    expect(
      areUtilisationOfferConsentsComplete(["transaction_details", "digital_authorisation"])
    ).toBe(false);
    expect(areUtilisationOfferConsentsComplete([...UTILISATION_OFFER_CONSENT_IDS])).toBe(true);
    expect(parseUtilisationOfferConsentIds(["transaction_details"])).toBeNull();
    expect(parseUtilisationOfferConsentIds(["transaction_details", "unknown"])).toBeNull();
    expect(parseUtilisationOfferConsentIds([...UTILISATION_OFFER_CONSENT_IDS].reverse())).toEqual([
      ...UTILISATION_OFFER_CONSENT_IDS,
    ]);
    expect(areUtilisationOfferConsentsComplete([...UTILISATION_OFFER_CONSENT_IDS, "transaction_details"])).toBe(
      false
    );
    expect(parseUtilisationOfferConsentIds([...UTILISATION_OFFER_CONSENT_IDS, "transaction_details"])).toBeNull();
  });

  it("stores the live consent wording and full authorisation with the acknowledgement", () => {
    const stamped = buildUtilisationOfferConsentAcknowledgement(
      [...UTILISATION_OFFER_CONSENT_IDS],
      "2026-08-24T10:00:00.000Z"
    );
    expect(stamped?.ids).toEqual([...UTILISATION_OFFER_CONSENT_IDS]);
    expect(stamped?.acknowledged_at).toBe("2026-08-24T10:00:00.000Z");
    expect(stamped?.statements.map((row) => row.id)).toEqual([...UTILISATION_OFFER_CONSENT_IDS]);
    expect(stamped?.statements.every((row) => row.label.length > 20)).toBe(true);
    expect(stamped?.binding_footer).toBe(UTILISATION_OFFER_BINDING_FOOTER);
    expect(stamped?.full_authorisation.version).toBe(UTILISATION_FULL_AUTHORISATION_VERSION);
    expect(stamped?.full_authorisation.title).toBe(UTILISATION_FULL_AUTHORISATION_TITLE);
    expect(stamped?.full_authorisation.clauses).toHaveLength(UTILISATION_FULL_AUTHORISATION_CLAUSES.length);
    expect(
      buildUtilisationOfferConsentAcknowledgement(["transaction_details"], "2026-08-24T10:00:00.000Z")
    ).toBeNull();
  });

  it("toggles visible consents in stable id order and keeps a confirmed authorisation", () => {
    const afterFirst = toggleUtilisationOfferConsent([], "transaction_details", true);
    expect(afterFirst).toEqual(["transaction_details"]);
    const afterSecond = toggleUtilisationOfferConsent(afterFirst, "digital_authorisation", true);
    expect(afterSecond).toEqual(["transaction_details", "digital_authorisation"]);
    const afterConfirm = confirmUtilisationFullAuthorisation(afterSecond);
    expect(afterConfirm).toEqual([...UTILISATION_OFFER_CONSENT_IDS]);
    expect(toggleUtilisationOfferConsent(afterConfirm, "digital_authorisation", false)).toEqual([
      "transaction_details",
      "full_authorisation",
    ]);
  });

  it("explains why Accept stays locked until the full authorisation is confirmed", () => {
    expect(utilisationOfferAcceptBlockedReason([])).toMatch(/Tick both confirmations/);
    expect(
      utilisationOfferAcceptBlockedReason(["transaction_details", "digital_authorisation"])
    ).toMatch(/Read the full authorisation/);
    expect(utilisationOfferAcceptBlockedReason([...UTILISATION_OFFER_CONSENT_IDS])).toBeNull();
    expect(UTILISATION_OFFER_CONSENTS_INTRO).toMatch(/Confirm and continue/);
  });

  it("computes indicative profit and amount payable from offered amount, rate, and tenure", () => {
    expect(
      computeIndicativeUtilisationProfit({
        offeredAmount: 800_000,
        profitRatePercent: 12,
        tenureDays: 90,
      })
    ).toBe(23_671.23);
    expect(computeIndicativeAmountPayable(800_000, 23_671.23)).toBe(823_671.23);
    expect(
      computeIndicativeUtilisationProfit({
        offeredAmount: 800_000,
        profitRatePercent: 12,
        tenureDays: null,
      })
    ).toBeNull();
    expect(computeIndicativeAmountPayable(800_000, null)).toBeNull();
  });
});
