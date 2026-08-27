import type { ContractFacilityLoMergeData } from "./facility-lo-merge.types";
import {
  CONTRACT_FACILITY_LO_MERGE_KEYS,
  FACILITY_LO_CHECKBOX_TICKED,
  FACILITY_LO_CHECKBOX_UNTICKED,
} from "./facility-lo-merge.types";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import {
  mapCorporateGuarantors,
  mapIndividualGuarantors,
  parseCorporateGuarantorsFromMergeInput,
  parseGuarantorsFromMergeInput,
} from "./facility-lo-guarantors";
import {
  daysPhrase,
  formatAddressBlock,
  formatDisplayDate,
  formatLetterDate,
  formatRmAmount,
  numberToWords,
} from "./lo-format";
import {
  getOfferAcceptanceFromOfferDetails,
  loIssuerAuthorizedNames,
  type FinancingStructureType,
} from "@cashsouk/types";

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

export function facilityLoCheckboxGlyphs(
  structureType: FinancingStructureType | null | undefined
): { part_a_checkbox: string; part_b_checkbox: string } {
  if (structureType === "new_contract") {
    return { part_a_checkbox: FACILITY_LO_CHECKBOX_TICKED, part_b_checkbox: FACILITY_LO_CHECKBOX_UNTICKED };
  }
  if (structureType === "invoice_only" || structureType === "existing_contract") {
    return { part_a_checkbox: FACILITY_LO_CHECKBOX_UNTICKED, part_b_checkbox: FACILITY_LO_CHECKBOX_TICKED };
  }
  return { part_a_checkbox: FACILITY_LO_CHECKBOX_UNTICKED, part_b_checkbox: FACILITY_LO_CHECKBOX_UNTICKED };
}

export type BuildFacilityLoMergeInput = {
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
    application_guarantors?: unknown;
  } | null;
  financingStructureType?: FinancingStructureType | null;
  /** Default grace days from platform finance settings when available. */
  gracePeriodDaysDefault?: number | null;
};

/**
 * Prefill merge data from platform entities. MISSING commercial terms stay empty
 * (or fixture defaults only where the map agreed a fixed legal constant).
 */
export function buildFacilityLoMergeData(input: BuildFacilityLoMergeInput): ContractFacilityLoMergeData {
  const base = createFacilityLoFixture();
  const emptyMissing: Partial<ContractFacilityLoMergeData> = {
    tenure_days: "",
    max_invoice_tenure_days: "",
    sub_limit_per_invoice_rm: "",
    part_b_financing_amount_rm: "",
    payment_period_days: "",
    grace_period_days: "",
    grace_period_days_words: "",
    transaction_docs_days: "",
    transaction_docs_days_words: "",
    moa_authorised_signatory_names: "",
    guarantors_individual: [],
    guarantors_corporate: [],
    ...facilityLoCheckboxGlyphs(input.financingStructureType),
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
  const facilityAmount = offeredFacility ?? approvedFacility;

  const sentAt = asString(offer?.sent_at);
  const letterDate = sentAt ? formatLetterDate(sentAt) : formatLetterDate(new Date());

  const individuals = mapIndividualGuarantors(guarantors);

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
    const start = Number.isFinite(startMs) ? startMs : Date.now();
    if (Number.isFinite(endMs) && endMs >= start) {
      const days = Math.max(1, Math.round((endMs - start) / (24 * 60 * 60 * 1000)));
      transactionDocsDays = String(days);
      transactionDocsWords = numberToWords(days);
    }
  }

  const authorizedParties = getOfferAcceptanceFromOfferDetails(
    input.contract.offer_details
  )?.authorized_parties;

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
    offer_validity_phrase: offerValidityPhrase,
    guarantors_individual: individuals,
    guarantors_corporate: mapCorporateGuarantors(
      guarantors,
      authorizedParties,
      input.application?.application_guarantors
    ),
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
    moa_authorised_signatory_names: loIssuerAuthorizedNames(authorizedParties),
  };
}

/** Coerce a partial/unknown body into a full merge object (form POST). */
export function normalizeContractFacilityLoMergeData(input: unknown): ContractFacilityLoMergeData {
  const base = createFacilityLoFixture();
  const src = asRecord(input) ?? {};
  const out = { ...base };
  for (const key of CONTRACT_FACILITY_LO_MERGE_KEYS) {
    const value = src[key];
    if (typeof value === "string") {
      out[key] = value;
    } else if (value != null) {
      out[key] = String(value);
    }
  }
  if (Array.isArray(src.guarantors_individual)) {
    out.guarantors_individual = parseGuarantorsFromMergeInput(src);
  }
  if (Array.isArray(src.guarantors_corporate)) {
    out.guarantors_corporate = parseCorporateGuarantorsFromMergeInput(src);
  }
  return out;
}
