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
    "The invoice represents payment for works certified and accepted by {paymasterName}.",
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

/**
 * Certification/acceptance sentence uses Paymaster name only.
 * No database proof of certification or acceptance — Operations must verify.
 */
export const PROSPECTUS_ABOUT_INVOICE_CERTIFICATION_REQUIRES_OPS_CONFIRMATION = true;

/**
 * Work-under-contract sentence uses contract description + Paymaster name.
 * Contract description does not prove work completion — Operations must verify.
 */
export const PROSPECTUS_ABOUT_INVOICE_WORK_COMPLETION_REQUIRES_OPS_CONFIRMATION = true;

export type ProspectusAboutInvoiceRecommendationInput = {
  paymasterSnapshot?: unknown;
  /** Frozen notes.contract_snapshot — work description from contract_details.description only. */
  contractSnapshot?: unknown;
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
 * Paymaster display name from frozen notes.paymaster_snapshot.name only.
 * No short-name / abbreviation derivation.
 */
export function resolveAboutInvoicePaymasterName(paymasterSnapshot: unknown): string {
  const snap = asRecord(paymasterSnapshot);
  return textOrEmpty(snap?.name);
}

/**
 * Work description from notes.contract_snapshot.contract_details.description only.
 * Does not read invoice description, top-level contract description, or financing purpose.
 */
export function resolveAboutInvoiceWorkDescription(contractSnapshot: unknown): string {
  const contract = asRecord(contractSnapshot);
  const contractDetails = asRecord(contract?.contract_details);
  return textOrEmpty(contractDetails?.description);
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
  const workDescription = resolveAboutInvoiceWorkDescription(input.contractSnapshot);
  const doaYes = input.deedOfAssignment === "Yes";

  const workUnderContract =
    workDescription && paymasterName
      ? fillTemplate(PROSPECTUS_ABOUT_INVOICE_TEMPLATES.work_under_contract, {
          workDescription,
          paymasterName,
        })
      : "";

  const certification = paymasterName
    ? fillTemplate(PROSPECTUS_ABOUT_INVOICE_TEMPLATES.certification_acceptance, {
        paymasterName,
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
