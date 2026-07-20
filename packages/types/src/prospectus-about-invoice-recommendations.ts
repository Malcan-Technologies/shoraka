/**
 * Suggested wording for Page 2 About the Invoice / Work Performed.
 * Canva templates with Note-snapshot tokens — Operations must confirm before Approve.
 */

export const PROSPECTUS_ABOUT_INVOICE_ITEM_IDS = [
  "work_under_contract",
  "certification_acceptance",
  "paymaster_trust_account",
  "deed_of_assignment",
] as const;

export type ProspectusAboutInvoiceItemId = (typeof PROSPECTUS_ABOUT_INVOICE_ITEM_IDS)[number];

export type ProspectusAboutInvoiceSourceType = "SYSTEM_SUGGESTION" | "OFFICER_ENTERED";

export type ProspectusAboutInvoiceItem = {
  id: ProspectusAboutInvoiceItemId | string;
  text: string;
  sourceType: ProspectusAboutInvoiceSourceType;
};

/** Exact Canva sentence templates (token placeholders in braces). */
export const PROSPECTUS_ABOUT_INVOICE_TEMPLATES = {
  work_under_contract:
    "The issuer has completed {workDescription} under a contract awarded by {paymasterName}.",
  certification_acceptance:
    "The invoice represents payment for works certified and accepted by {paymasterShortName}.",
  paymaster_trust_account:
    "Payment will be distributed directly by the paymaster to the CashSouk trust account on the invoice due date.",
  deed_of_assignment:
    "The invoice has been assigned to CashSouk as security via a Deed of Assignment (DOA).",
} as const;

/**
 * Trust-account sentence is suggested copy only — not wired to a coded universal
 * platform payment rule. Operations must confirm before Approve.
 */
export const PROSPECTUS_ABOUT_INVOICE_TRUST_ACCOUNT_REQUIRES_OPS_CONFIRMATION = true;

export type ProspectusAboutInvoiceRecommendationInput = {
  paymasterSnapshot?: unknown;
  /** Frozen notes.purpose_snapshot — Prospectus purpose / financing_for text. */
  purposeSnapshot?: unknown;
  contractSnapshot?: unknown;
  invoiceSnapshot?: unknown;
  /** Officer Page 2 DOA selection — only "Yes" prefills the DOA suggestion. */
  deedOfAssignment?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOrEmpty(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Paymaster display name from frozen notes.paymaster_snapshot.name.
 */
export function resolveAboutInvoicePaymasterName(paymasterSnapshot: unknown): string {
  const snap = asRecord(paymasterSnapshot);
  return textOrEmpty(snap?.name);
}

/**
 * Approved short Paymaster name when present on the snapshot; otherwise full name.
 * Does not invent abbreviations from parenthetical suffixes.
 */
export function resolveAboutInvoicePaymasterShortName(paymasterSnapshot: unknown): string {
  const snap = asRecord(paymasterSnapshot);
  const short =
    textOrEmpty(snap?.short_name) ||
    textOrEmpty(snap?.shortName) ||
    textOrEmpty(snap?.approved_short_name) ||
    textOrEmpty(snap?.abbreviation);
  if (short) return short;
  return resolveAboutInvoicePaymasterName(paymasterSnapshot);
}

/**
 * Work description from Contract / Invoice description when present on frozen snapshots;
 * otherwise Prospectus purpose text (notes.purpose_snapshot.financing_for).
 * Never uses issuer identity, industry, financials, or AI text.
 */
export function resolveAboutInvoiceWorkDescription(input: {
  contractSnapshot?: unknown;
  invoiceSnapshot?: unknown;
  purposeSnapshot?: unknown;
}): string {
  const invoice = asRecord(input.invoiceSnapshot);
  const invoiceDetails = asRecord(invoice?.details);
  const fromInvoice = textOrEmpty(invoiceDetails?.description);
  if (fromInvoice) return fromInvoice;

  const contract = asRecord(input.contractSnapshot);
  const contractDetails = asRecord(contract?.contract_details);
  const fromContract =
    textOrEmpty(contractDetails?.description) || textOrEmpty(contract?.description);
  if (fromContract) return fromContract;

  const purpose = asRecord(input.purposeSnapshot);
  return textOrEmpty(purpose?.financing_for);
}

/**
 * Replace {token} placeholders. If a token sits immediately before a template
 * period and the token already ends with ".", drop the token's trailing periods
 * so names like "Sdn. Bhd." do not produce "Sdn. Bhd.."
 */
function fillTemplate(
  template: string,
  tokens: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}(\.)?/g, (_, key: string, period?: string) => {
    let value = tokens[key] ?? "";
    if (period && /\.+$/.test(value)) {
      value = value.replace(/\.+$/, "");
    }
    return `${value}${period ?? ""}`;
  });
}

/**
 * Build the four suggestion strings from Note snapshots + officer DOA selection.
 * Missing work/paymaster tokens → empty suggestion for that slot (Ops must enter).
 * DOA slot is empty unless deedOfAssignment === "Yes".
 */
export function buildProspectusAboutInvoiceRecommendations(
  input: ProspectusAboutInvoiceRecommendationInput = {}
): Record<ProspectusAboutInvoiceItemId, { text: string }> {
  const paymasterName = resolveAboutInvoicePaymasterName(input.paymasterSnapshot);
  const paymasterShortName = resolveAboutInvoicePaymasterShortName(input.paymasterSnapshot);
  const workDescription = resolveAboutInvoiceWorkDescription({
    contractSnapshot: input.contractSnapshot,
    invoiceSnapshot: input.invoiceSnapshot,
    purposeSnapshot: input.purposeSnapshot,
  });
  const doaYes = input.deedOfAssignment === "Yes";

  const workUnderContract =
    workDescription && paymasterName
      ? fillTemplate(PROSPECTUS_ABOUT_INVOICE_TEMPLATES.work_under_contract, {
          workDescription,
          paymasterName,
        })
      : "";

  const certification =
    paymasterShortName
      ? fillTemplate(PROSPECTUS_ABOUT_INVOICE_TEMPLATES.certification_acceptance, {
          paymasterShortName,
        })
      : "";

  return {
    work_under_contract: { text: workUnderContract },
    certification_acceptance: { text: certification },
    paymaster_trust_account: {
      text: PROSPECTUS_ABOUT_INVOICE_TEMPLATES.paymaster_trust_account,
    },
    deed_of_assignment: {
      text: doaYes ? PROSPECTUS_ABOUT_INVOICE_TEMPLATES.deed_of_assignment : "",
    },
  };
}

/** @deprecated Prefer buildProspectusAboutInvoiceRecommendations(input). */
export const PROSPECTUS_ABOUT_INVOICE_SUGGESTIONS = PROSPECTUS_ABOUT_INVOICE_TEMPLATES;
