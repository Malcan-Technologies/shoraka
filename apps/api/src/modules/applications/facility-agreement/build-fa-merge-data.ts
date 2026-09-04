import type { FacilityAgreementMergeData } from "./fa-merge.types";
import { createFacilityAgreementFixture } from "./fa-fixture";
import {
  mapCorporateGuarantors,
  mapIndividualGuarantors,
} from "../letter-of-offer/facility-lo-guarantors";
import { formatLetterDate, formatRmAmount } from "../letter-of-offer/lo-format";
import {
  resolveIssuerRegistrationNumber,
  resolveRegisteredAddress,
} from "../letter-of-offer/build-facility-lo-merge-data";
import {
  authorizedRepresentativeCapacityLabel,
  getIssuerAuthorizedParty,
  getLoAuthorizedPartiesFromAcceptance,
  getOfferAcceptanceFromOfferDetails,
  malaysianBankSwift,
  readInvoiceSubLimitPerInvoiceRmFromWorkflow,
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

function formatPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value}%`;
}

export function formatFaFacilityDescription(amountRm: string, letterDate: string): string {
  if (!amountRm.trim() || !letterDate.trim()) return "";
  return `Account Receivable Financing-i Facility of ${amountRm} as described in the Letter of Offer dated ${letterDate}`;
}

function fieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function readBankField(content: unknown[], name: string): string {
  const target = fieldKey(name);
  for (const item of content) {
    const row = asRecord(item);
    if (!row) continue;
    const fieldName = fieldKey(asString(row.fieldName));
    const alias = fieldKey(asString(row.alias));
    if (fieldName === target || alias === target) return asString(row.fieldValue);
  }
  return "";
}

function readIssuerBank(org: {
  name?: string | null;
  bank_account_details?: unknown;
}): {
  issuer_bank_name: string;
  issuer_bank_account_number: string;
  issuer_bank_account_name: string;
  issuer_bank_swift: string;
} {
  const empty = {
    issuer_bank_name: "",
    issuer_bank_account_number: "",
    issuer_bank_account_name: "",
    issuer_bank_swift: "",
  };
  const details = asRecord(org.bank_account_details);
  if (!details) return empty;

  if (typeof details.bank_name === "string" || typeof details.account_number === "string") {
    const bankName = asString(details.bank_name);
    return {
      issuer_bank_name: bankName,
      issuer_bank_account_number: asString(details.account_number),
      issuer_bank_account_name:
        asString(details.account_holder) || (bankName ? asString(org.name) : ""),
      issuer_bank_swift:
        asString(details.swift_code) || asString(details.swift) || malaysianBankSwift(bankName),
    };
  }

  const content = Array.isArray(details.content) ? details.content : [];
  const bankName = readBankField(content, "Bank") || readBankField(content, "bankName");
  return {
    issuer_bank_name: bankName,
    issuer_bank_account_number:
      readBankField(content, "Bank account number") || readBankField(content, "Account number"),
    issuer_bank_account_name:
      readBankField(content, "Account name") ||
      readBankField(content, "Account holder") ||
      (bankName ? asString(org.name) : ""),
    issuer_bank_swift:
      readBankField(content, "SWIFT Code") ||
      readBankField(content, "SWIFT") ||
      readBankField(content, "swiftCode") ||
      malaysianBankSwift(bankName),
  };
}

export type FacilityAgreementOfferKind = "contract" | "invoice";

export type BuildFacilityAgreementMergeInput = {
  offerKind: FacilityAgreementOfferKind;
  contract: {
    id: string;
    contract_details?: unknown;
    offer_details?: unknown;
    issuer_organization_id: string;
  };
  invoice?: {
    id: string;
    display_reference?: unknown;
    offer_details?: unknown;
  } | null;
  issuerOrganization: {
    id: string;
    name?: string | null;
    registration_number?: string | null;
    address?: string | null;
    bank_account_details?: unknown;
    corporate_onboarding_data?: unknown;
  };
  application?: {
    id: string;
    company_details?: unknown;
    application_guarantors?: unknown;
  } | null;
  productWorkflow?: unknown;
  trusteeDisclosureEmail?: string | null;
  /** When the Facility Agreement is generated. Defaults to now (Asia/Kuala_Lumpur). */
  generatedAt?: string | Date | null;
};

export function buildFacilityAgreementMergeData(
  input: BuildFacilityAgreementMergeInput
): FacilityAgreementMergeData {
  const base = createFacilityAgreementFixture();
  const emptyMissing: Partial<FacilityAgreementMergeData> = {
    facility_agreement_date: "",
    letter_date: "",
    our_reference: "",
    issuer_name: "",
    issuer_registration_number: "",
    issuer_address: "",
    issuer_email: "",
    facility_description: "",
    financing_limit_rm: "",
    sub_limit_per_invoice_rm: "",
    facility_fee_rate_percent: "",
    drawdown_fee: "",
    trustee_disclosure_email: "",
    issuer_bank_name: "",
    issuer_bank_account_number: "",
    issuer_bank_account_name: "",
    issuer_bank_swift: "",
    guarantors_individual: [],
    guarantors_corporate: [],
    issuer_signatories: [],
  };

  const offerDetails =
    input.offerKind === "invoice" ? input.invoice?.offer_details : input.contract.offer_details;
  const offer = asRecord(offerDetails);
  const contractDetails = asRecord(input.contract.contract_details);
  const company = asRecord(input.application?.company_details);
  const contact = asRecord(company?.contact_person);

  const sentAt = asString(offer?.sent_at);
  const letterDate = sentAt ? formatLetterDate(sentAt) : "";

  const offeredFacility = asNumber(offer?.offered_facility);
  const approvedFacility = asNumber(contractDetails?.approved_facility);
  const offeredAmount = asNumber(offer?.offered_amount);
  const facilityAmount =
    input.offerKind === "invoice" ? offeredAmount : (offeredFacility ?? approvedFacility);
  const amountRm = formatRmAmount(facilityAmount ?? undefined);

  const subLimitRm = readInvoiceSubLimitPerInvoiceRmFromWorkflow(input.productWorkflow);
  const subLimitFormatted =
    formatRmAmount(subLimitRm ?? undefined) ||
    (input.offerKind === "invoice" ? amountRm : "");

  const facilityFeeRate =
    input.offerKind === "contract"
      ? asNumber(offer?.facility_fee_rate_percent) ?? asNumber(contractDetails?.facility_fee_rate_percent)
      : null;
  const drawdownFeeRate =
    input.offerKind === "invoice" ? asNumber(offer?.platform_fee_rate_percent) : null;

  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  const authorizedParties = getLoAuthorizedPartiesFromAcceptance(acceptance);
  const issuerParty = getIssuerAuthorizedParty(authorizedParties);
  const liveGuarantors = input.application?.application_guarantors;
  const bank = readIssuerBank(input.issuerOrganization);

  return {
    ...base,
    ...emptyMissing,
    facility_agreement_date: formatLetterDate(input.generatedAt ?? new Date()),
    letter_date: letterDate,
    our_reference:
      input.offerKind === "invoice"
        ? asString(input.invoice?.display_reference) || asString(input.invoice?.id)
        : input.contract.id,
    issuer_name: asString(input.issuerOrganization.name),
    issuer_registration_number: resolveIssuerRegistrationNumber(input.issuerOrganization),
    issuer_address: resolveRegisteredAddress(input.issuerOrganization),
    issuer_email: asString(contact?.email),
    facility_description: formatFaFacilityDescription(amountRm, letterDate),
    financing_limit_rm: amountRm,
    sub_limit_per_invoice_rm: subLimitFormatted,
    facility_fee_rate_percent: formatPercent(facilityFeeRate),
    drawdown_fee: formatPercent(drawdownFeeRate),
    trustee_disclosure_email: asString(input.trusteeDisclosureEmail),
    ...bank,
    guarantors_individual: mapIndividualGuarantors(liveGuarantors),
    guarantors_corporate: mapCorporateGuarantors(liveGuarantors, authorizedParties),
    issuer_signatories: (issuerParty?.representatives ?? []).map((rep) => ({
      name: asString(rep.name),
      designation: authorizedRepresentativeCapacityLabel(rep.capacity),
    })),
  };
}
