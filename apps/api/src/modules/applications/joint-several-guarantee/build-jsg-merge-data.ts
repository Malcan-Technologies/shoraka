import type { JsgMergeData } from "./jsg-merge.types";
import { createJsgFixture } from "./jsg-fixture";
import {
  mapCorporateGuarantors,
  mapFinanceDocumentsGuarantors,
  mapIndividualGuarantors,
} from "../letter-of-offer/facility-lo-guarantors";
import { formatLetterDate, formatRmAmount } from "../letter-of-offer/lo-format";
import {
  resolveBusinessAddress,
  resolveIssuerRegistrationNumber,
  resolveRegisteredAddress,
} from "../letter-of-offer/build-facility-lo-merge-data";
import { getLoAuthorizedPartiesFromAcceptance, getOfferAcceptanceFromOfferDetails } from "@cashsouk/types";

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

export function formatJsgFacilityDescription(amountRm: string, letterDate: string): string {
  if (!amountRm.trim() || !letterDate.trim()) return "";
  return `Account Receivable Financing-i Facility of ${amountRm} as described in the Letter of Offer dated ${letterDate}`;
}

export type BuildJsgMergeInput = {
  contract: {
    id: string;
    contract_details?: unknown;
    offer_details?: unknown;
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
    application_guarantors?: unknown;
  } | null;
};

export function buildJsgMergeData(input: BuildJsgMergeInput): JsgMergeData {
  const base = createJsgFixture();
  const emptyMissing: Partial<JsgMergeData> = {
    guarantee_date: "",
    letter_date: "",
    our_reference: "",
    issuer_name: "",
    issuer_registration_number: "",
    issuer_address: "",
    issuer_business_address: "",
    facility_description: "",
    guarantors_individual: [],
    guarantors_corporate: [],
    schedule_guarantors: [],
  };

  const offer = asRecord(input.contract.offer_details);
  const contractDetails = asRecord(input.contract.contract_details);
  const offeredFacility = asNumber(offer?.offered_facility);
  const approvedFacility = asNumber(contractDetails?.approved_facility);
  const facilityAmount = offeredFacility ?? approvedFacility;
  const sentAt = asString(offer?.sent_at);
  const letterDate = sentAt ? formatLetterDate(sentAt) : "";
  const amountRm = formatRmAmount(facilityAmount ?? undefined);

  const acceptance = getOfferAcceptanceFromOfferDetails(input.contract.offer_details);
  const authorizedParties = getLoAuthorizedPartiesFromAcceptance(acceptance);
  const liveGuarantors = input.application?.application_guarantors;

  return {
    ...base,
    ...emptyMissing,
    guarantee_date: letterDate,
    letter_date: letterDate,
    our_reference: input.contract.id,
    issuer_name: asString(input.issuerOrganization.name),
    issuer_registration_number: resolveIssuerRegistrationNumber(input.issuerOrganization),
    issuer_address: resolveRegisteredAddress(input.issuerOrganization),
    issuer_business_address: resolveBusinessAddress(input.issuerOrganization),
    facility_description: formatJsgFacilityDescription(amountRm, letterDate),
    guarantors_individual: mapIndividualGuarantors(liveGuarantors),
    guarantors_corporate: mapCorporateGuarantors(liveGuarantors, authorizedParties),
    schedule_guarantors: mapFinanceDocumentsGuarantors(liveGuarantors, authorizedParties),
  };
}
