/**
 * Offer-acceptance phase (Option A): status lives on offer_details.offer_acceptance.
 * Acknowledgements are product-config docs the issuer previews + checkboxes in Step 1.
 * See docs/guides/application-flow/offer-acceptance-and-signing-phases.md
 */

import { getStepKeyFromStepId } from "./application-steps";
import {
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  resolveAcceptanceDocumentsFromWorkflow,
  workflowHasAcceptanceDocuments,
} from "./acceptance-documents";

export const OFFER_ACKNOWLEDGEMENTS_WORKFLOW_KEY = "offer_acknowledgements";

export type OfferAcceptanceStatus =
  | "PENDING_ISSUER"
  | "PENDING_ADMIN_REVIEW"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "DECLINED"
  | "APPROVED_FOR_SIGNING"
  | "SIGNING_IN_PROGRESS"
  | "COMPLETED";

export const OFFER_ACCEPTANCE_STATUSES: readonly OfferAcceptanceStatus[] = [
  "PENDING_ISSUER",
  "PENDING_ADMIN_REVIEW",
  "CHANGES_REQUESTED",
  "REJECTED",
  "DECLINED",
  "APPROVED_FOR_SIGNING",
  "SIGNING_IN_PROGRESS",
  "COMPLETED",
] as const;

export type OfferAcknowledgementContentSource =
  | "html_template"
  | "generated_offer_letter"
  | "template_pdf"
  | "static_text";

/** Stable keys for built-in HTML placeholders (swap bodies later without changing product keys). */
export type OfferAcknowledgementTemplateKey = "letter_of_offer" | "guarantee_acknowledgement";

export const OFFER_ACKNOWLEDGEMENT_TEMPLATE_KEYS: readonly OfferAcknowledgementTemplateKey[] = [
  "letter_of_offer",
  "guarantee_acknowledgement",
] as const;

/**
 * Hardcoded HTML placeholders for this pass. Replace with real templated HTML (merge fields)
 * when legal copy is ready — keep template_key stable.
 */
export const OFFER_ACKNOWLEDGEMENT_HTML_PLACEHOLDERS: Record<
  OfferAcknowledgementTemplateKey,
  string
> = {
  letter_of_offer: `
<h2>Letter of Offer</h2>
<p><strong>Placeholder content</strong> — this text will be replaced with the formal Letter of Offer HTML template later.</p>
<p>By continuing, you acknowledge that you have read and understood the terms of this financing offer, including the facility amount, fees, and conditions set out in the Letter of Offer.</p>
<p>This acknowledgement is not an electronic signature of the execution pack. Signing of the Facility Agreement and related documents happens in a later step after CashSouk reviews your acceptance documents.</p>
`.trim(),
  guarantee_acknowledgement: `
<h2>Guarantee Acknowledgement</h2>
<p><strong>Placeholder content</strong> — this text will be replaced with the formal Guarantee Acknowledgement HTML template later.</p>
<p>By continuing, you acknowledge that you understand the guarantee obligations associated with this facility, including that guarantors may be required to execute a Joint and Several Guarantee (JSG) as part of the signing package.</p>
<p>This acknowledgement is not the signed guarantee itself.</p>
`.trim(),
};

export type OfferAcknowledgementDocument = {
  key: string;
  name: string;
  /** Omitted or true → required */
  required?: boolean;
  content_source: OfferAcknowledgementContentSource;
  /** When content_source === "html_template" — picks a built-in HTML placeholder body */
  template_key?: OfferAcknowledgementTemplateKey;
  /** When content_source === "static_text" */
  static_text?: string;
  /** When content_source === "template_pdf" */
  template?: { s3_key: string; file_name: string; file_size?: number };
};

/**
 * Default pair for facility flow: Letter of Offer + Guarantee Acknowledgement.
 * LOO binds to the system offer-letter PDF. Guarantee requires admin-supplied
 * static text or an uploaded PDF — placeholder HTML is not production-ready.
 */
export const DEFAULT_OFFER_ACKNOWLEDGEMENTS: readonly OfferAcknowledgementDocument[] = [
  {
    key: "letter_of_offer",
    name: "Letter of Offer",
    required: true,
    content_source: "generated_offer_letter",
  },
  {
    key: "guarantee_acknowledgement",
    name: "Guarantee Acknowledgement",
    required: true,
    content_source: "static_text",
  },
] as const;

/**
 * Built-in HTML template keys that still only ship engineering placeholders.
 * Product save must reject these until legal supplies production-ready templates.
 */
export const OFFER_ACKNOWLEDGEMENT_PLACEHOLDER_TEMPLATE_KEYS: readonly OfferAcknowledgementTemplateKey[] =
  OFFER_ACKNOWLEDGEMENT_TEMPLATE_KEYS;

export function isOfferAcknowledgementTemplateKey(
  value: unknown
): value is OfferAcknowledgementTemplateKey {
  return (
    typeof value === "string" &&
    OFFER_ACKNOWLEDGEMENT_TEMPLATE_KEYS.includes(value as OfferAcknowledgementTemplateKey)
  );
}

/** Resolve HTML body for an acknowledgement row (placeholder for now). */
export function resolveOfferAcknowledgementHtml(
  doc: Pick<OfferAcknowledgementDocument, "content_source" | "template_key" | "key" | "static_text">
): string | null {
  if (doc.content_source === "static_text") {
    return doc.static_text?.trim() ? doc.static_text : null;
  }
  if (doc.content_source !== "html_template") return null;
  const key = isOfferAcknowledgementTemplateKey(doc.template_key)
    ? doc.template_key
    : isOfferAcknowledgementTemplateKey(doc.key)
      ? doc.key
      : null;
  if (!key) return null;
  return OFFER_ACKNOWLEDGEMENT_HTML_PLACEHOLDERS[key];
}

export type OfferAcknowledgementRecord = {
  document_key: string;
  accepted_at: string;
  accepted_by_user_id: string;
};

/**
 * Frozen commercial terms at Step 1 submit — audit/display only; not used for pricing.
 * Shape is a union of contract + invoice fields present on the offer at acknowledgement time.
 */
export type OfferAcknowledgedTermsSnapshot = {
  offer_version: number;
  product_version: number | null;
  expires_at: string | null;
  offered_facility?: number;
  facility_fee_rate_percent?: number | null;
  offered_amount?: number;
  offered_ratio_percent?: number | null;
  offered_profit_rate_percent?: number | null;
  platform_fee_rate_percent?: number | null;
  risk_rating?: string | null;
};

export type OfferAcceptanceDetails = {
  status: OfferAcceptanceStatus;
  acknowledgements?: OfferAcknowledgementRecord[];
  /** Set on Step 1 submit; proves which commercial numbers were acknowledged. */
  acknowledged_terms?: OfferAcknowledgedTermsSnapshot;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isOfferAcceptanceStatus(value: unknown): value is OfferAcceptanceStatus {
  return typeof value === "string" && OFFER_ACCEPTANCE_STATUSES.includes(value as OfferAcceptanceStatus);
}

export function parseOfferAcceptanceDetails(value: unknown): OfferAcceptanceDetails | null {
  const root = asRecord(value);
  if (!root) return null;
  if (!isOfferAcceptanceStatus(root.status)) return null;
  const acknowledgements: OfferAcknowledgementRecord[] = [];
  if (Array.isArray(root.acknowledgements)) {
    for (const row of root.acknowledgements) {
      const r = asRecord(row);
      if (!r) continue;
      if (typeof r.document_key !== "string" || !r.document_key) continue;
      if (typeof r.accepted_at !== "string" || !r.accepted_at) continue;
      if (typeof r.accepted_by_user_id !== "string" || !r.accepted_by_user_id) continue;
      acknowledgements.push({
        document_key: r.document_key,
        accepted_at: r.accepted_at,
        accepted_by_user_id: r.accepted_by_user_id,
      });
    }
  }
  const acknowledgedTerms = parseAcknowledgedTermsSnapshot(root.acknowledged_terms);
  return {
    status: root.status,
    ...(acknowledgements.length > 0 ? { acknowledgements } : {}),
    ...(acknowledgedTerms ? { acknowledged_terms: acknowledgedTerms } : {}),
    submitted_at: typeof root.submitted_at === "string" ? root.submitted_at : root.submitted_at === null ? null : undefined,
    reviewed_at: typeof root.reviewed_at === "string" ? root.reviewed_at : root.reviewed_at === null ? null : undefined,
    reviewed_by_user_id:
      typeof root.reviewed_by_user_id === "string"
        ? root.reviewed_by_user_id
        : root.reviewed_by_user_id === null
          ? null
          : undefined,
  };
}

function parseOptionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function parseOptionalNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return parseOptionalFiniteNumber(value);
}

export function parseAcknowledgedTermsSnapshot(
  value: unknown
): OfferAcknowledgedTermsSnapshot | null {
  const root = asRecord(value);
  if (!root) return null;
  const offerVersion = parseOptionalFiniteNumber(root.offer_version);
  if (offerVersion == null) return null;
  const productVersion =
    root.product_version === null
      ? null
      : (parseOptionalFiniteNumber(root.product_version) ?? null);
  const expiresAt =
    typeof root.expires_at === "string"
      ? root.expires_at
      : root.expires_at === null
        ? null
        : null;
  const snapshot: OfferAcknowledgedTermsSnapshot = {
    offer_version: offerVersion,
    product_version: productVersion,
    expires_at: expiresAt,
  };
  const offeredFacility = parseOptionalFiniteNumber(root.offered_facility);
  if (offeredFacility != null) snapshot.offered_facility = offeredFacility;
  const facilityFee = parseOptionalNullableNumber(root.facility_fee_rate_percent);
  if (facilityFee !== undefined) snapshot.facility_fee_rate_percent = facilityFee;
  const offeredAmount = parseOptionalFiniteNumber(root.offered_amount);
  if (offeredAmount != null) snapshot.offered_amount = offeredAmount;
  const offeredRatio = parseOptionalNullableNumber(root.offered_ratio_percent);
  if (offeredRatio !== undefined) snapshot.offered_ratio_percent = offeredRatio;
  const offeredProfit = parseOptionalNullableNumber(root.offered_profit_rate_percent);
  if (offeredProfit !== undefined) snapshot.offered_profit_rate_percent = offeredProfit;
  const platformFee = parseOptionalNullableNumber(root.platform_fee_rate_percent);
  if (platformFee !== undefined) snapshot.platform_fee_rate_percent = platformFee;
  if (typeof root.risk_rating === "string") {
    snapshot.risk_rating = root.risk_rating;
  } else if (root.risk_rating === null) {
    snapshot.risk_rating = null;
  }
  return snapshot;
}

/**
 * Copy commercial fields from current offer_details for Step 1 audit snapshot.
 * Display/audit only — callers must not use this to drive pricing.
 */
export function buildAcknowledgedTermsSnapshot(params: {
  offerDetails: Record<string, unknown>;
  productVersion: number | null | undefined;
}): OfferAcknowledgedTermsSnapshot {
  const offer = params.offerDetails;
  const offerVersion = parseOptionalFiniteNumber(offer.version) ?? 0;
  const expiresAt =
    typeof offer.expires_at === "string"
      ? offer.expires_at
      : offer.expires_at === null
        ? null
        : null;
  const snapshot: OfferAcknowledgedTermsSnapshot = {
    offer_version: offerVersion,
    product_version:
      params.productVersion != null && Number.isFinite(params.productVersion)
        ? params.productVersion
        : null,
    expires_at: expiresAt,
  };
  const offeredFacility = parseOptionalFiniteNumber(offer.offered_facility);
  if (offeredFacility != null) snapshot.offered_facility = offeredFacility;
  const facilityFee = parseOptionalNullableNumber(offer.facility_fee_rate_percent);
  if (facilityFee !== undefined) snapshot.facility_fee_rate_percent = facilityFee;
  const offeredAmount = parseOptionalFiniteNumber(offer.offered_amount);
  if (offeredAmount != null) snapshot.offered_amount = offeredAmount;
  const offeredRatio = parseOptionalNullableNumber(offer.offered_ratio_percent);
  if (offeredRatio !== undefined) snapshot.offered_ratio_percent = offeredRatio;
  const offeredProfit = parseOptionalNullableNumber(offer.offered_profit_rate_percent);
  if (offeredProfit !== undefined) snapshot.offered_profit_rate_percent = offeredProfit;
  const platformFee = parseOptionalNullableNumber(offer.platform_fee_rate_percent);
  if (platformFee !== undefined) snapshot.platform_fee_rate_percent = platformFee;
  if (typeof offer.risk_rating === "string") {
    snapshot.risk_rating = offer.risk_rating;
  } else if (offer.risk_rating === null) {
    snapshot.risk_rating = null;
  }
  return snapshot;
}

/**
 * True when admin must retract before sending a new offer version.
 * Absent acceptance (legacy) or PENDING_ISSUER with no acks / submitted_at → re-send allowed.
 */
export function isOfferAcceptanceResendBlocked(
  acceptance: OfferAcceptanceDetails | null | undefined
): boolean {
  if (!acceptance) return false;
  if (acceptance.status !== "PENDING_ISSUER") return true;
  if ((acceptance.acknowledgements?.length ?? 0) > 0) return true;
  if (typeof acceptance.submitted_at === "string" && acceptance.submitted_at.length > 0) {
    return true;
  }
  return false;
}

export function isOfferAcknowledgementPlaceholderTemplateKey(
  value: unknown
): value is OfferAcknowledgementTemplateKey {
  return (
    typeof value === "string" &&
    OFFER_ACKNOWLEDGEMENT_PLACEHOLDER_TEMPLATE_KEYS.includes(
      value as OfferAcknowledgementTemplateKey
    )
  );
}

/** Read offer_acceptance from a contract/invoice offer_details blob. */
export function getOfferAcceptanceFromOfferDetails(
  offerDetails: unknown
): OfferAcceptanceDetails | null {
  const root = asRecord(offerDetails);
  if (!root) return null;
  return parseOfferAcceptanceDetails(root.offer_acceptance);
}

export function createInitialOfferAcceptanceDetails(): OfferAcceptanceDetails {
  return { status: "PENDING_ISSUER" };
}

/** Merge offer_acceptance into an offer_details object (shallow). */
export function withOfferAcceptance(
  offerDetails: Record<string, unknown>,
  acceptance: OfferAcceptanceDetails
): Record<string, unknown> {
  return { ...offerDetails, offer_acceptance: acceptance };
}

/** Issuer UI: signing steps are visible after admin approval (including completed packages). */
export function offerAcceptanceAllowsSigning(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "APPROVED_FOR_SIGNING" || status === "SIGNING_IN_PROGRESS" || status === "COMPLETED";
}

/** Create a draft signing package only from the approved-for-signing phase. */
export function offerAcceptanceAllowsCreateSigningPackage(
  status: OfferAcceptanceStatus | null | undefined
): boolean {
  return status === "APPROVED_FOR_SIGNING";
}

/** Send (or re-send after draft) while approved or already marked signing-in-progress. */
export function offerAcceptanceAllowsSendSigningPackage(
  status: OfferAcceptanceStatus | null | undefined
): boolean {
  return status === "APPROVED_FOR_SIGNING" || status === "SIGNING_IN_PROGRESS";
}

export function offerAcceptanceIsStep1Editable(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "PENDING_ISSUER" || status === "CHANGES_REQUESTED" || status == null;
}

export function offerAcceptanceIsTerminal(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "REJECTED" || status === "DECLINED" || status === "COMPLETED";
}

export function offerAcceptanceIsAwaitingAdmin(status: OfferAcceptanceStatus | null | undefined): boolean {
  return status === "PENDING_ADMIN_REVIEW";
}

/**
 * Whether the issuer Review Offer CTA should show for this acceptance phase.
 * Hidden while waiting on admin (`PENDING_ADMIN_REVIEW`); legacy offers (no status) keep the CTA.
 */
export function offerAcceptanceAllowsIssuerReviewCta(
  status: OfferAcceptanceStatus | null | undefined
): boolean {
  if (status == null) return true;
  return (
    status === "PENDING_ISSUER" ||
    status === "CHANGES_REQUESTED" ||
    status === "APPROVED_FOR_SIGNING" ||
    status === "SIGNING_IN_PROGRESS"
  );
}

const CONTENT_SOURCES: readonly OfferAcknowledgementContentSource[] = [
  "html_template",
  "generated_offer_letter",
  "template_pdf",
  "static_text",
];

function slugifyKey(name: string, index: number): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `acknowledgement_${index}`;
}

function parseAcknowledgementRow(raw: unknown, index: number): OfferAcknowledgementDocument | null {
  const row = asRecord(raw);
  if (!row) return null;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return null;
  const key =
    typeof row.key === "string" && row.key.trim() ? row.key.trim() : slugifyKey(name, index);
  const contentSource = CONTENT_SOURCES.includes(row.content_source as OfferAcknowledgementContentSource)
    ? (row.content_source as OfferAcknowledgementContentSource)
    : key === "letter_of_offer"
      ? "generated_offer_letter"
      : "static_text";
  const template = asRecord(row.template);
  const out: OfferAcknowledgementDocument = {
    key,
    name,
    required: row.required === false ? false : true,
    content_source: contentSource,
  };
  if (contentSource === "html_template") {
    if (isOfferAcknowledgementTemplateKey(row.template_key)) {
      out.template_key = row.template_key;
    } else if (isOfferAcknowledgementTemplateKey(key)) {
      out.template_key = key;
    } else {
      out.template_key = "letter_of_offer";
    }
  }
  if (contentSource === "static_text" && typeof row.static_text === "string") {
    out.static_text = row.static_text;
  }
  if (
    contentSource === "template_pdf" &&
    template &&
    typeof template.s3_key === "string" &&
    template.s3_key
  ) {
    out.template = {
      s3_key: template.s3_key,
      file_name:
        (typeof template.file_name === "string" && template.file_name) ||
        (typeof template.filename === "string" && template.filename) ||
        "template.pdf",
      ...(typeof template.file_size === "number" ? { file_size: template.file_size } : {}),
    };
  }
  return out;
}

function findFinancingTypeConfig(workflow: unknown): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const step of workflow) {
    const sid = String((step as { id?: unknown })?.id ?? "");
    if (getStepKeyFromStepId(sid) !== "financing_type") continue;
    return asRecord((step as { config?: unknown }).config);
  }
  return null;
}

export function parseOfferAcknowledgementsConfig(financingConfig: unknown): OfferAcknowledgementDocument[] {
  const config = asRecord(financingConfig) ?? {};
  const list = config[OFFER_ACKNOWLEDGEMENTS_WORKFLOW_KEY];
  if (!Array.isArray(list)) return [];
  const parsed: OfferAcknowledgementDocument[] = [];
  const seenKeys = new Set<string>();
  list.forEach((row, index) => {
    const doc = parseAcknowledgementRow(row, index);
    if (!doc) return;
    let key = doc.key;
    if (seenKeys.has(key)) key = `${key}_${index}`;
    seenKeys.add(key);
    parsed.push({ ...doc, key });
  });
  return parsed;
}

export function writeOfferAcknowledgementsConfig(
  financingConfig: Record<string, unknown>,
  rows: OfferAcknowledgementDocument[]
): Record<string, unknown> {
  return {
    ...financingConfig,
    [OFFER_ACKNOWLEDGEMENTS_WORKFLOW_KEY]: rows.map((row) => ({
      key: row.key,
      name: row.name,
      required: row.required !== false,
      content_source: row.content_source,
      ...(row.content_source === "html_template" && row.template_key
        ? { template_key: row.template_key }
        : {}),
      ...(row.content_source === "static_text" && row.static_text != null
        ? { static_text: row.static_text }
        : {}),
      ...(row.content_source === "template_pdf" && row.template
        ? { template: row.template }
        : {}),
    })),
  };
}

export function resolveOfferAcknowledgementsFromWorkflow(
  workflow: unknown
): OfferAcknowledgementDocument[] {
  return parseOfferAcknowledgementsConfig(findFinancingTypeConfig(workflow));
}

export function workflowHasOfferAcknowledgements(workflow: unknown): boolean {
  return resolveOfferAcknowledgementsFromWorkflow(workflow).length > 0;
}

/**
 * True when the product uses the phased accept → admin review → signing flow.
 * Legacy products with neither acknowledgements nor acceptance docs keep the old path.
 * Runtime: only enforce the phase gate when offer_details.offer_acceptance is present
 * (new offers). Older offers without the field keep presence-only create/send.
 */
export function workflowUsesOfferAcceptanceFlow(workflow: unknown): boolean {
  return workflowHasOfferAcknowledgements(workflow) || workflowHasAcceptanceDocuments(workflow);
}

/** Required acknowledgement keys that must be present on submit. */
export function requiredOfferAcknowledgementKeys(workflow: unknown): string[] {
  return resolveOfferAcknowledgementsFromWorkflow(workflow)
    .filter((doc) => doc.required !== false)
    .map((doc) => doc.key);
}

/**
 * After Step 1 submit: if there are acceptance docs to review, wait for admin;
 * otherwise unlock signing immediately (acknowledgements-only products).
 */
export function resolveStatusAfterOfferAcceptanceSubmit(workflow: unknown): OfferAcceptanceStatus {
  return resolveAcceptanceDocumentsFromWorkflow(workflow).length > 0
    ? "PENDING_ADMIN_REVIEW"
    : "APPROVED_FOR_SIGNING";
}

export type OfferAcceptanceStatusPresentation = {
  label: string;
  /** Short hint for admin / issuer banners */
  hint: string;
};

export function getOfferAcceptanceStatusPresentation(
  status: OfferAcceptanceStatus
): OfferAcceptanceStatusPresentation {
  switch (status) {
    case "PENDING_ISSUER":
      return { label: "Pending issuer", hint: "Issuer must acknowledge documents and upload acceptance files." };
    case "PENDING_ADMIN_REVIEW":
      return { label: "Pending admin review", hint: "Review acceptance documents before signing can start." };
    case "CHANGES_REQUESTED":
      return { label: "Changes requested", hint: "Issuer must update acceptance documents and resubmit." };
    case "REJECTED":
      return { label: "Acceptance rejected", hint: "Offer was withdrawn after acceptance was rejected." };
    case "DECLINED":
      return { label: "Offer declined", hint: "Issuer declined this offer; acceptance and signing are closed." };
    case "APPROVED_FOR_SIGNING":
      return { label: "Approved for signing", hint: "Issuer can configure signers and send the signing package." };
    case "SIGNING_IN_PROGRESS":
      return { label: "Signing in progress", hint: "Signing package has been sent." };
    case "COMPLETED":
      return { label: "Completed", hint: "Signing package completed; offer accepted." };
  }
}

/** Re-export key for product validation with acceptance docs. */
export { ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY };
