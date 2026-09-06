import type { PaymasterLookupResult, PaymasterLookupStatus } from "@cashsouk/types";
import { isPaymasterSsmSwitchingLocked, isPaymasterVerified } from "@cashsouk/types";

export type YesNo = "yes" | "no";

export function isRelatedPartyAnswered(value: string): value is YesNo {
  return value === "yes" || value === "no";
}

export function isTwelveDigitRegistration(value: string): boolean {
  return /^\d{12}$/.test(value);
}

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function readLinkedPaymasterFromContract(contract: unknown): {
  verified: boolean;
  registrationNumber: string;
} | null {
  if (!contract || typeof contract !== "object") return null;
  const paymaster = (contract as { paymaster?: unknown }).paymaster;
  if (!paymaster || typeof paymaster !== "object") return null;
  const row = paymaster as {
    verificationStatus?: string | null;
    verification_status?: string | null;
    registrationNumber?: string | null;
    registration_number?: string | null;
  };
  const registrationNumber = digitsOnly(row.registrationNumber ?? row.registration_number);
  if (!isTwelveDigitRegistration(registrationNumber)) return null;
  return {
    verified: isPaymasterVerified(row.verificationStatus ?? row.verification_status),
    registrationNumber,
  };
}

export function linkedPaymasterSameSsm(params: {
  linkedRegistrationNumber?: string | null;
  ssmNumber: string;
}): boolean {
  return (
    isTwelveDigitRegistration(params.ssmNumber) &&
    digitsOnly(params.linkedRegistrationNumber) === params.ssmNumber
  );
}

export function isFacilityPaymasterLocked(
  contractStatus: string | null | undefined,
  lifecycle?: {
    applicationStatus?: string | null;
    invoiceStatuses?: readonly string[];
  }
): boolean {
  return isPaymasterSsmSwitchingLocked({
    applicationStatus: lifecycle?.applicationStatus ?? "",
    contractStatus,
    invoiceStatuses: lifecycle?.invoiceStatuses,
  });
}

export function customerIdentityLocked(params: {
  stepEditable: boolean;
  facilityPaymasterLocked: boolean;
  lookupStatus: PaymasterLookupStatus | "idle";
  linkedVerifiedSameSsm?: boolean;
}): boolean {
  if (!params.stepEditable || params.facilityPaymasterLocked) return true;
  if (params.linkedVerifiedSameSsm) return true;
  return params.lookupStatus === "FOUND_VERIFIED";
}

export function isVerifiedPaymasterLookup(
  lookupStatus: PaymasterLookupStatus | "idle"
): boolean {
  return lookupStatus === "FOUND_VERIFIED";
}

export function showCustomerMasterFields(params: {
  facilityPaymasterLocked: boolean;
  lookupStatus: PaymasterLookupStatus | "idle";
  ssmNumber: string;
  linkedSameSsm?: boolean;
}): boolean {
  if (params.facilityPaymasterLocked) return true;
  if (!isTwelveDigitRegistration(params.ssmNumber)) return false;
  if (params.linkedSameSsm) return true;
  return (
    params.lookupStatus === "FOUND_VERIFIED" ||
    params.lookupStatus === "FOUND_UNVERIFIED" ||
    params.lookupStatus === "NOT_FOUND"
  );
}

export function relatedPartyFieldsVisible(params: {
  facilityPaymasterLocked: boolean;
  lookupStatus: PaymasterLookupStatus | "idle";
  ssmNumber: string;
  linkedSameSsm?: boolean;
}): boolean {
  return showCustomerMasterFields(params);
}

export function customerStepValid(params: {
  lookupStatus: PaymasterLookupStatus | "idle";
  facilityPaymasterLocked: boolean;
  name: string;
  entityType: string;
  ssmNumber: string;
  country: string;
  relatedParty: string;
  linkedSameSsm?: boolean;
}): boolean {
  if (!isRelatedPartyAnswered(params.relatedParty)) return false;
  if (!isTwelveDigitRegistration(params.ssmNumber) || !params.country) return false;
  if (!params.name || !params.entityType) return false;
  if (params.facilityPaymasterLocked || params.linkedSameSsm) return true;
  return (
    params.lookupStatus === "FOUND_VERIFIED" ||
    params.lookupStatus === "FOUND_UNVERIFIED" ||
    params.lookupStatus === "NOT_FOUND"
  );
}

export function lookupStatusFromResult(
  result: PaymasterLookupResult | null
): PaymasterLookupStatus | "idle" {
  if (!result) return "idle";
  return result.status;
}
