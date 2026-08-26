/** Issuer-facing terms for a digital utilisation (drawdown) under an approved facility. */

import { NOTE_MONEY_DECIMALS } from "./note-money";
import { roundNoteMoney } from "./note-expected-return";

export type UtilisationOfferTermClause = {
  title: string;
  body: string;
};

export const UTILISATION_OFFER_TERMS_TITLE = "Utilisation terms and conditions";

export const UTILISATION_OFFER_TERMS_INTRO =
  "This offer is a utilisation of your existing approved facility. The commercial terms on this offer apply to this invoice only. Confirming the verification code sent to the authorised signatory accepts these terms for your organisation.";

export const UTILISATION_OFFER_TERMS_READ_LINK = "Read utilisation terms and conditions";

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

export const UTILISATION_OFFER_CONSENTS_TITLE = "Required confirmation";

export const UTILISATION_OFFER_CONSENTS_INTRO =
  "Tick both confirmations. You must also open Read full authorisation and tap Confirm and continue before Accept is available.";

export const UTILISATION_OFFER_CONSENTS_LETTER_INTRO =
  "The following confirmations form part of the issuer organisation’s acceptance of this utilisation.";

export const UTILISATION_OFFER_BINDING_FOOTER =
  "I confirm that I am an authorised signatory and intend this acceptance to be legally binding.";

export const UTILISATION_OFFER_LETTER_CLOSE =
  "Acceptance of this utilisation is completed when the authorised signatory confirms the verification code sent to their registered email. No signature is required on this letter.";

export const UTILISATION_OFFER_VISIBLE_CONSENT_IDS = [
  "transaction_details",
  "digital_authorisation",
] as const;

export const UTILISATION_OFFER_CONSENT_IDS = [
  ...UTILISATION_OFFER_VISIBLE_CONSENT_IDS,
  "full_authorisation",
] as const;

export type UtilisationOfferConsentId = (typeof UTILISATION_OFFER_CONSENT_IDS)[number];
export type UtilisationOfferVisibleConsentId = (typeof UTILISATION_OFFER_VISIBLE_CONSENT_IDS)[number];

export type UtilisationOfferConsent = {
  id: UtilisationOfferVisibleConsentId;
  title: string;
  detail: string;
  hasFullAuthorisationLink?: boolean;
};

export const UTILISATION_OFFER_CONSENTS: readonly UtilisationOfferConsent[] = [
  {
    id: "transaction_details",
    title: "I confirm and accept the transaction details",
    detail:
      "I confirm that the information and documents submitted are complete and accurate, and I accept the Utilisation Offer and the terms displayed",
  },
  {
    id: "digital_authorisation",
    title:
      "I confirm the information submitted, accept this Utilisation Offer and authorise the digital financing process.",
    detail:
      "I authorise CashSouk to publish the financing request and, subject to successful funding, complete and electronically record the required financing, investment note, agency and Shariah transaction steps under the Facility Agreement.",
    hasFullAuthorisationLink: true,
  },
];

export const UTILISATION_FULL_AUTHORISATION_VERSION = "2026-08-19";

export const UTILISATION_FULL_AUTHORISATION_TITLE =
  "Digital Utilisation Acceptance and Authorisation";

export const UTILISATION_FULL_AUTHORISATION_INTRO =
  "By selecting this checkbox and completing the required authentication, I confirm and agree, for and on behalf of the Issuer, that (in this authorisation, “CashSouk” means the Platform operated by Shoraka Suyula Platform Sdn. Bhd. (Registration No. 202101033028 [1433328-H]) as Agent, and terms defined in the Facility Agreement have the same meaning here):";

export const UTILISATION_FULL_AUTHORISATION_READ_LINK = "Read full authorisation";

export const UTILISATION_FULL_AUTHORISATION_REQUIRED_HINT =
  "Open this, then tap Confirm and continue. Accept stays locked until you do.";

export const UTILISATION_FULL_AUTHORISATION_CONFIRMED_LABEL = "Full authorisation confirmed";

export const UTILISATION_FULL_AUTHORISATION_READ_AGAIN = "Read again";

export const UTILISATION_FULL_AUTHORISATION_CLOSE = "Close";

export const UTILISATION_FULL_AUTHORISATION_CONFIRM = "Confirm and continue";

export type UtilisationFullAuthorisationClause = {
  title: string;
  paragraphs: readonly string[];
};

export const UTILISATION_FULL_AUTHORISATION_CLAUSES: readonly UtilisationFullAuthorisationClause[] =
  [
    {
      title: "Utilisation information",
      paragraphs: [
        "The information, declarations and supporting documents submitted through the Platform for this utilisation, including the relevant invoice, receivable, customer, financing and payment information, are complete, accurate and not misleading.",
        "The electronic information submitted through the Platform confirms the Issuer’s Utilisation Request previously submitted under Clause 3.4 and Schedule 4 and satisfies the corresponding requirements of the Facility Agreement.",
      ],
    },
    {
      title: "Acceptance of the Utilisation Offer",
      paragraphs: [
        "I have reviewed and accept the Utilisation Offer displayed on the Platform, including the approved financing amount, financing margin, profit rate, tenure, maturity information, fees, estimated net proceeds and other transaction terms.",
        "I understand that amounts identified as indicative may be recalculated using the actual amount successfully funded and the applicable funding or disbursement date.",
      ],
    },
    {
      title: "Authority to publish and raise funding",
      paragraphs: [
        "I authorise CashSouk to prepare, publish, host and offer the relevant Investment Note on the Platform for subscription by investors, in accordance with the accepted Utilisation Offer and the Facility Agreement.",
      ],
    },
    {
      title: "Investment Note",
      paragraphs: [
        "Subject to successful completion of the fundraising campaign, I authorise CashSouk to generate, complete, authenticate, date and electronically retain the relevant Investment Note using information recorded on the Platform, on the basis that CashSouk acts in its respective capacities as agent for and on behalf of the Issuer and as Facility Agent, and that the electronic record will identify the capacity in which each act is performed.",
        "The Investment Note may contain the final amount funded, applicable profit, tenure, maturity date and other transaction particulars determined upon completion of the fundraising campaign.",
      ],
    },
    {
      title: "Purchase requisition and undertaking",
      paragraphs: [
        "Subject to successful funding and the conditions of the Facility Agreement being satisfied, the Issuer hereby issues the Purchase Requisition (comprising the Purchase Request and the Undertaking to Purchase (Wa’d)) contemplated under Clause 3A.1(ii) and Schedule 6 of the Facility Agreement, and requests CashSouk to undertake the required Shariah-compliant commodity transaction.",
        "The Issuer irrevocably undertakes to purchase the relevant Commodity from CashSouk and to pay the price by exchanging the Receivable with the Commodity on the terms prescribed by the Facility Agreement and authorises the corresponding purchase requisition, undertaking or transaction record to be generated and recorded electronically.",
      ],
    },
    {
      title: "Agency appointment",
      paragraphs: [
        "The Issuer appoints CashSouk as its agent or wakeel and authorises CashSouk to perform the acts required to complete the financing and Shariah transaction, including purchasing or selling the relevant commodity, executing the applicable transaction records, applying transaction proceeds and taking the actions permitted under the Facility Agreement.",
        "Any appointment made by investors will be accepted separately by the relevant investors through the investor subscription process. Nothing in this acceptance constitutes an acceptance by the Issuer on behalf of any investor.",
      ],
    },
    {
      title: "Sale Contract and Shariah transaction records",
      paragraphs: [
        "Subject to the relevant conditions being satisfied, I authorise CashSouk to generate, populate, execute and electronically record the applicable Sale Contract and related commodity transaction records.",
        "CashSouk may populate those records using transaction information recorded on the Platform or received from the commodity trading provider, including dates, amounts, commodity descriptions, certificates and transaction references.",
      ],
    },
    {
      title: "Conditional effectiveness",
      paragraphs: [
        "I understand that an authorisation or transaction record that is conditional upon successful fundraising, acquisition or sale of a commodity, disbursement or another transaction event will only take effect when the relevant event occurs.",
        "Acceptance of this Utilisation Offer does not, by itself, confirm that the campaign has been successfully funded or that a disbursement has occurred.",
      ],
    },
    {
      title: "Electronic records",
      paragraphs: [
        "I agree that the relevant requests, confirmations, instructions, appointments, undertakings, Investment Notes, contracts and transaction records may be created, accepted, executed and retained electronically through the Platform.",
        "Such electronic records need not reproduce the exact layout of the corresponding schedules to the Facility Agreement, provided that they contain substantially the required information and are created in accordance with CashSouk’s approved digital process.",
      ],
    },
    {
      title: "Authority and binding effect",
      paragraphs: [
        "I confirm that I am an authorised signatory or representative of the Issuer, duly authorised under the Issuer’s board resolution authorising acceptance of the Facility and the giving of these authorisations, and have authority to give these confirmations and authorisations.",
        "I intend my electronic acceptance, together with the Platform authentication and audit record, to be legally binding upon the Issuer in accordance with the Facility Agreement.",
      ],
    },
    {
      title: "Record of full authorisation",
      paragraphs: [
        "I confirm that I have been given access to, and have read, this full Digital Utilisation Acceptance and Authorisation via the “Read full authorisation” function, and I agree that the version displayed and accepted, together with the checkbox wording, applicable document versions, my authenticated identity and the date and time of acceptance, shall be captured in the Platform audit record and incorporated into my acceptance in accordance with Clause 3A.4 of the Facility Agreement.",
      ],
    },
  ];

export const INVOICE_OFFER_INDICATIVE_PROFIT_TOOLTIP =
  "Estimated as approved financing × profit rate × tenure / 365. The actual amount uses the funded amount and the funding or disbursement date.";

export const INVOICE_OFFER_INDICATIVE_PAYABLE_TOOLTIP =
  "Approved financing plus indicative profit. Recalculated when funding completes.";

const CONSENT_ID_SET = new Set<string>(UTILISATION_OFFER_CONSENT_IDS);

function consentStatementLabel(consent: UtilisationOfferConsent): string {
  return `${consent.title} ${consent.detail}`.trim();
}

export function computeIndicativeUtilisationProfit(input: {
  offeredAmount: number | null | undefined;
  profitRatePercent: number | null | undefined;
  tenureDays: number | null | undefined;
}): number | null {
  const offeredAmount = input.offeredAmount;
  const profitRatePercent = input.profitRatePercent;
  const tenureDays = input.tenureDays;
  if (
    offeredAmount == null ||
    profitRatePercent == null ||
    tenureDays == null ||
    !Number.isFinite(offeredAmount) ||
    !Number.isFinite(profitRatePercent) ||
    !Number.isFinite(tenureDays)
  ) {
    return null;
  }
  return roundNoteMoney(
    Math.max(0, offeredAmount) *
      (Math.max(0, profitRatePercent) / 100) *
      (Math.max(0, tenureDays) / 365),
    NOTE_MONEY_DECIMALS
  );
}

export function computeIndicativeAmountPayable(
  offeredAmount: number | null | undefined,
  indicativeProfit: number | null | undefined
): number | null {
  if (
    offeredAmount == null ||
    indicativeProfit == null ||
    !Number.isFinite(offeredAmount) ||
    !Number.isFinite(indicativeProfit)
  ) {
    return null;
  }
  return roundNoteMoney(Math.max(0, offeredAmount) + Math.max(0, indicativeProfit), NOTE_MONEY_DECIMALS);
}

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
  binding_footer: string;
  full_authorisation: {
    version: string;
    title: string;
    intro: string;
    clauses: Array<{ title: string; paragraphs: string[] }>;
  };
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
    statements: [
      ...UTILISATION_OFFER_CONSENTS.map((consent) => ({
        id: consent.id,
        label: consentStatementLabel(consent),
      })),
      {
        id: "full_authorisation",
        label: UTILISATION_FULL_AUTHORISATION_TITLE,
      },
    ],
    binding_footer: UTILISATION_OFFER_BINDING_FOOTER,
    full_authorisation: {
      version: UTILISATION_FULL_AUTHORISATION_VERSION,
      title: UTILISATION_FULL_AUTHORISATION_TITLE,
      intro: UTILISATION_FULL_AUTHORISATION_INTRO,
      clauses: UTILISATION_FULL_AUTHORISATION_CLAUSES.map((clause) => ({
        title: clause.title,
        paragraphs: [...clause.paragraphs],
      })),
    },
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

export function confirmUtilisationFullAuthorisation(
  ids: readonly string[]
): UtilisationOfferConsentId[] {
  return toggleUtilisationOfferConsent(ids, "full_authorisation", true);
}

export function utilisationOfferAcceptBlockedReason(ids: readonly string[]): string | null {
  if (areUtilisationOfferConsentsComplete(ids)) return null;
  const visibleComplete = UTILISATION_OFFER_VISIBLE_CONSENT_IDS.every((id) => ids.includes(id));
  if (visibleComplete && !ids.includes("full_authorisation")) {
    return "Read the full authorisation and tap Confirm and continue to enable Accept.";
  }
  return "Tick both confirmations and confirm the full authorisation to enable Accept.";
}

export function utilisationFullAuthorisationPlainText(): string {
  return [
    UTILISATION_FULL_AUTHORISATION_TITLE,
    "",
    UTILISATION_FULL_AUTHORISATION_INTRO,
    "",
    ...UTILISATION_FULL_AUTHORISATION_CLAUSES.flatMap((clause, index) => [
      `${index + 1}. ${clause.title}`,
      ...clause.paragraphs,
      "",
    ]),
  ]
    .join("\n")
    .trim();
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
    ...UTILISATION_OFFER_CONSENTS.map((consent) => `${consent.title} ${consent.detail}`),
    UTILISATION_OFFER_BINDING_FOOTER,
    "",
    utilisationFullAuthorisationPlainText(),
    "",
    UTILISATION_OFFER_LETTER_CLOSE,
  ].join("\n");
}
