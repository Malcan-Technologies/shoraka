/** Issuer-facing terms for a digital utilisation (drawdown) under an approved facility. */

export type UtilisationOfferTermClause = {
  title: string;
  body: string;
};

export const UTILISATION_OFFER_TERMS_TITLE = "Utilisation terms and conditions";

export const UTILISATION_OFFER_TERMS_INTRO =
  "This offer is a utilisation of your existing approved facility. The commercial terms on this offer apply to this invoice only. Confirming the verification code sent to the authorised signatory accepts these terms for your organisation.";

export const UTILISATION_OFFER_TERM_CLAUSES: readonly UtilisationOfferTermClause[] = [
  {
    title: "Existing facility",
    body: "This request draws on the facility you have already accepted. The facility agreement and facility letter of offer stay in force. Accepting this utilisation does not create a new facility.",
  },
  {
    title: "This utilisation",
    body: "The invoice, financing amount, tenure, profit rate, and fees shown on this offer are the terms for this drawdown only.",
  },
  {
    title: "How you accept",
    body: "Because the facility is already signed, this utilisation does not need a new signature. Acceptance is complete when the authorised signatory confirms the verification code sent to their registered email. That confirmation binds the issuer organisation.",
  },
  {
    title: "Fees",
    body: "The drawdown fee, any facility-fee collection, and any extra fees on this offer are locked when you accept. They are charged only if investors fund the note successfully.",
  },
  {
    title: "Listing and funding",
    body: "After acceptance, CashSouk may list this invoice for investors. Funding is not guaranteed. If the listing does not raise the minimum, the fees on this offer are not charged and the reserved facility amount is released.",
  },
  {
    title: "Payout and repayment",
    body: "If funding succeeds, the net amount after the fees on this offer is paid to you. The invoice amount remains due on the stated maturity date, usually from the paymaster.",
  },
];

export const UTILISATION_OFFER_CONSENTS_TITLE = "Required confirmations";

export const UTILISATION_OFFER_CONSENTS_INTRO =
  "Accept is available only after every confirmation below is ticked. These acknowledgements form part of your organisation’s acceptance of this utilisation.";

export const UTILISATION_OFFER_CONSENTS_LETTER_INTRO =
  "The following confirmations form part of the issuer organisation’s acceptance of this utilisation.";

export const UTILISATION_OFFER_LETTER_CLOSE =
  "Acceptance of this utilisation is completed when the authorised signatory confirms the verification code sent to their registered email. No signature is required on this letter.";

export const UTILISATION_OFFER_CONSENT_IDS = [
  "terms",
  "authority",
  "binding_acceptance",
  "funding_and_fees",
] as const;

export type UtilisationOfferConsentId = (typeof UTILISATION_OFFER_CONSENT_IDS)[number];

export type UtilisationOfferConsent = {
  id: UtilisationOfferConsentId;
  label: string;
};

export const UTILISATION_OFFER_CONSENTS: readonly UtilisationOfferConsent[] = [
  {
    id: "terms",
    label:
      "I have read and understood the utilisation terms and conditions and the commercial terms of this offer, and I agree that they govern this drawdown.",
  },
  {
    id: "authority",
    label:
      "I confirm that the authorised signatory who will receive the verification code has due authority to bind the issuer organisation to this utilisation.",
  },
  {
    id: "binding_acceptance",
    label:
      "I acknowledge that confirmation of that verification code is a legally binding acceptance of this utilisation under the existing facility agreement, and that no further signature is required.",
  },
  {
    id: "funding_and_fees",
    label:
      "I understand that investor funding is not guaranteed, that unused facility reservation is released if the listing fails, and that the fees on this offer become payable only if funding succeeds.",
  },
];

const CONSENT_ID_SET = new Set<string>(UTILISATION_OFFER_CONSENT_IDS);

export function areUtilisationOfferConsentsComplete(ids: readonly string[]): boolean {
  if (ids.length !== UTILISATION_OFFER_CONSENT_IDS.length) return false;
  return UTILISATION_OFFER_CONSENT_IDS.every((id) => ids.includes(id));
}

export function parseUtilisationOfferConsentIds(value: unknown): UtilisationOfferConsentId[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((id) => typeof id === "string" && CONSENT_ID_SET.has(id))) return null;
  if (!areUtilisationOfferConsentsComplete(value)) return null;
  return [...UTILISATION_OFFER_CONSENT_IDS];
}

export type UtilisationOfferConsentAcknowledgement = {
  ids: UtilisationOfferConsentId[];
  statements: Array<{ id: UtilisationOfferConsentId; label: string }>;
  acknowledged_at: string;
};

/** Persist the live wording with the ids so later copy edits do not rewrite the audit trail. */
export function buildUtilisationOfferConsentAcknowledgement(
  ids: unknown,
  acknowledgedAt: string
): UtilisationOfferConsentAcknowledgement | null {
  const parsed = parseUtilisationOfferConsentIds(ids);
  if (!parsed) return null;
  return {
    ids: parsed,
    statements: UTILISATION_OFFER_CONSENTS.map((consent) => ({
      id: consent.id,
      label: consent.label,
    })),
    acknowledged_at: acknowledgedAt,
  };
}

export function toggleUtilisationOfferConsent(
  ids: readonly string[],
  id: UtilisationOfferConsentId,
  checked: boolean
): UtilisationOfferConsentId[] {
  const next = new Set(ids.filter((item): item is UtilisationOfferConsentId => CONSENT_ID_SET.has(item)));
  if (checked) next.add(id);
  else next.delete(id);
  return UTILISATION_OFFER_CONSENT_IDS.filter((item) => next.has(item));
}

export function utilisationOfferTermsPlainText(): string {
  return [
    UTILISATION_OFFER_TERMS_TITLE,
    "",
    UTILISATION_OFFER_TERMS_INTRO,
    "",
    ...UTILISATION_OFFER_TERM_CLAUSES.map((clause) => `${clause.title}. ${clause.body}`),
    "",
    UTILISATION_OFFER_CONSENTS_TITLE,
    UTILISATION_OFFER_CONSENTS_LETTER_INTRO,
    ...UTILISATION_OFFER_CONSENTS.map((consent) => consent.label),
    "",
    UTILISATION_OFFER_LETTER_CLOSE,
  ].join("\n");
}
