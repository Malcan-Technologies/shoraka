import type { ContractLooMergeData } from "./contract-loo-merge.types";
import { CONTRACT_LOO_MERGE_KEYS } from "./contract-loo-merge.types";
import { createContractLooFixture } from "./contract-loo-fixture";
import {
  daysPhrase,
  formatAddressBlock,
  formatDisplayDate,
  formatLetterDate,
  formatRmAmount,
  numberToWords,
} from "./loo-format";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function guarantorLine(name: string, nric: string): string {
  if (!name) return "";
  return nric ? `${name} (NRIC No. ${nric})` : name;
}

function resolveRegisteredAddress(org: {
  address?: string | null;
  corporate_onboarding_data?: unknown;
}): string {
  const cod = asRecord(org.corporate_onboarding_data);
  const addresses = asRecord(cod?.addresses);
  const registered =
    asRecord(addresses?.registered) ?? asRecord(addresses?.registeredAddress) ?? null;
  if (registered) {
    const formatted = formatAddressBlock({
      line1: asString(registered.line1 ?? registered.addressLine1),
      line2: asString(registered.line2 ?? registered.addressLine2),
      city: asString(registered.city),
      postcode: asString(registered.postcode ?? registered.postalCode),
      state: asString(registered.state),
      country: asString(registered.country),
    });
    if (formatted) return formatted;
  }
  return asString(org.address);
}

export type BuildContractLooMergeInput = {
  contract: {
    id: string;
    contract_details?: unknown;
    offer_details?: unknown;
    customer_details?: unknown;
    issuer_organization_id: string;
  };
  issuerOrganization: {
    id: string;
    name?: string | null;
    registration_number?: string | null;
    address?: string | null;
    corporate_onboarding_data?: unknown;
  };
  application?: {
    id: string;
    company_details?: unknown;
    business_details?: unknown;
  } | null;
  /** Default grace days from platform finance settings when available. */
  gracePeriodDaysDefault?: number | null;
};

/**
 * Prefill merge data from platform entities. MISSING commercial terms stay empty
 * (or fixture defaults only where the map agreed a fixed legal constant).
 */
export function buildContractLooMergeData(input: BuildContractLooMergeInput): ContractLooMergeData {
  const base = createContractLooFixture();
  // Start blank for editable MISSING fields; keep fixed legal defaults.
  const emptyMissing: Partial<ContractLooMergeData> = {
    margin_of_receivable_percent: "",
    profit_rate_percent: "",
    tenure_days: "",
    payment_period_days: "",
    grace_period_days: "",
    grace_period_days_words: "",
    transaction_docs_days: "",
    transaction_docs_days_words: "",
    moa_authorised_signatory_names: "",
    corporate_guarantor_name: "",
    corporate_guarantor_ssm: "",
    corporate_signatory_1_name: "",
    corporate_signatory_2_name: "",
    guarantor_1_line: "",
    guarantor_2_line: "",
    guarantor_3_line: "",
    guarantor_1_name: "",
    guarantor_2_name: "",
  };

  const offer = asRecord(input.contract.offer_details);
  const contractDetails = asRecord(input.contract.contract_details);
  const customer = asRecord(input.contract.customer_details);
  const company = asRecord(input.application?.company_details);
  const contact = asRecord(company?.contact_person);
  const business = asRecord(input.application?.business_details);
  const guarantors = Array.isArray(business?.guarantors) ? business.guarantors : [];

  const offeredFacility = asNumber(offer?.offered_facility);
  const approvedFacility = asNumber(contractDetails?.approved_facility);
  const contractValue =
    asNumber(contractDetails?.value) ??
    asNumber(contractDetails?.contract_value) ??
    asNumber(contractDetails?.financing);
  const facilityAmount = offeredFacility ?? approvedFacility;

  // F3 decision: ratio of approved/offered facility to contract amount when both exist
  let margin = "";
  if (facilityAmount != null && contractValue != null && contractValue > 0) {
    margin = ((facilityAmount / contractValue) * 100).toFixed(2).replace(/\.00$/, "");
  }

  const sentAt = asString(offer?.sent_at);
  const letterDate = sentAt ? formatLetterDate(sentAt) : formatLetterDate(new Date());

  const individuals = guarantors
    .map((g) => asRecord(g))
    .filter((g): g is JsonRecord => !!g && asString(g.guarantor_type) === "individual");
  const companies = guarantors
    .map((g) => asRecord(g))
    .filter((g): g is JsonRecord => !!g && asString(g.guarantor_type) === "company");

  const g1 = individuals[0];
  const g2 = individuals[1];
  const g3 = individuals[2];
  const corp = companies[0];

  const graceDefault =
    input.gracePeriodDaysDefault != null && Number.isFinite(input.gracePeriodDaysDefault)
      ? Math.floor(input.gracePeriodDaysDefault)
      : null;

  const acceptance = asRecord(offer?.offer_acceptance);
  const acceptanceExpires = asString(acceptance?.acceptance_expires_at);
  let offerValidityPhrase = base.offer_validity_phrase;
  if (acceptanceExpires && sentAt) {
    const start = new Date(sentAt).getTime();
    const end = new Date(acceptanceExpires).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      const days = Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)));
      offerValidityPhrase = daysPhrase(days);
    }
  }

  const signingExpires = asString(acceptance?.signing_expires_at);
  let transactionDocsDays = "";
  let transactionDocsWords = "";
  if (signingExpires && (sentAt || acceptanceExpires)) {
    const startMs = new Date(sentAt || letterDate).getTime();
    const endMs = new Date(signingExpires).getTime();
    // Prefer acceptance submitted / letter date as start; if invalid, skip
    const start = Number.isFinite(startMs) ? startMs : Date.now();
    if (Number.isFinite(endMs) && endMs >= start) {
      const days = Math.max(1, Math.round((endMs - start) / (24 * 60 * 60 * 1000)));
      transactionDocsDays = String(days);
      transactionDocsWords = numberToWords(days);
    }
  }

  return {
    ...base,
    ...emptyMissing,
    issuer_id: input.issuerOrganization.id || input.contract.issuer_organization_id,
    our_reference: input.contract.id,
    letter_date: letterDate,
    issuer_name: asString(input.issuerOrganization.name),
    issuer_registration_number: asString(input.issuerOrganization.registration_number),
    issuer_address: resolveRegisteredAddress(input.issuerOrganization),
    attention_name: asString(contact?.name),
    attention_position: asString(contact?.position),
    financing_limit_rm: formatRmAmount(facilityAmount ?? undefined),
    margin_of_receivable_percent: margin,
    availability_period_phrase: base.availability_period_phrase,
    withdrawal_notice_phrase: base.withdrawal_notice_phrase,
    offer_validity_phrase: offerValidityPhrase,
    guarantor_1_line: g1 ? guarantorLine(asString(g1.name), asString(g1.ic_number)) : "",
    guarantor_2_line: g2 ? guarantorLine(asString(g2.name), asString(g2.ic_number)) : "",
    guarantor_3_line: g3 ? guarantorLine(asString(g3.name), asString(g3.ic_number)) : "",
    guarantor_1_name: g1 ? asString(g1.name) : "",
    guarantor_2_name: g2 ? asString(g2.name) : "",
    grace_period_days: graceDefault != null ? String(graceDefault) : "",
    grace_period_days_words: graceDefault != null ? numberToWords(graceDefault) : "",
    transaction_docs_days: transactionDocsDays,
    transaction_docs_days_words: transactionDocsWords,
    assigned_contract_date: formatDisplayDate(asString(contractDetails?.start_date)),
    assigned_contract_counterparty: asString(customer?.name),
    assigned_contract_description:
      asString(contractDetails?.title) ||
      asString(contractDetails?.description) ||
      asString(contractDetails?.number),
    corporate_guarantor_name: corp ? asString(corp.business_name) : "",
    corporate_guarantor_ssm: corp ? asString(corp.ssm_number) : "",
  };
}

/** Coerce a partial/unknown body into a full merge object (form POST). */
export function normalizeContractLooMergeData(input: unknown): ContractLooMergeData {
  const base = createContractLooFixture();
  const src = asRecord(input) ?? {};
  const out = { ...base };
  for (const key of CONTRACT_LOO_MERGE_KEYS) {
    const value = src[key];
    if (typeof value === "string") {
      out[key] = value;
    } else if (value != null) {
      out[key] = String(value);
    }
  }
  return out;
}
