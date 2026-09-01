import type { PaymasterLookupResult, PaymasterLookupStatus } from "@cashsouk/types";

export type YesNo = "yes" | "no";

export function isRelatedPartyAnswered(value: string): value is YesNo {
  return value === "yes" || value === "no";
}

export function isTwelveDigitRegistration(value: string): boolean {
  return /^\d{12}$/.test(value);
}

export function isFacilityPaymasterLocked(contractStatus: string | null | undefined): boolean {
  return (
    typeof contractStatus === "string" &&
    contractStatus !== "DRAFT" &&
    contractStatus !== "AMENDMENT_REQUESTED"
  );
}

export function customerIdentityLocked(params: {
  stepEditable: boolean;
  facilityPaymasterLocked: boolean;
  lookupStatus: PaymasterLookupStatus | "idle";
}): boolean {
  if (!params.stepEditable || params.facilityPaymasterLocked) return true;
  return params.lookupStatus === "FOUND_VERIFIED";
}

export function showCustomerMasterFields(params: {
  facilityPaymasterLocked: boolean;
  lookupStatus: PaymasterLookupStatus | "idle";
  ssmNumber: string;
}): boolean {
  if (params.facilityPaymasterLocked) return true;
  if (!isTwelveDigitRegistration(params.ssmNumber)) return false;
  return params.lookupStatus === "FOUND_VERIFIED" || params.lookupStatus === "NOT_FOUND";
}

export function relatedPartyFieldsVisible(params: {
  facilityPaymasterLocked: boolean;
  lookupStatus: PaymasterLookupStatus | "idle";
  ssmNumber: string;
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
}): boolean {
  if (!isRelatedPartyAnswered(params.relatedParty)) return false;
  if (!isTwelveDigitRegistration(params.ssmNumber) || !params.country) return false;
  if (!params.name || !params.entityType) return false;
  if (params.facilityPaymasterLocked) return true;
  return params.lookupStatus === "FOUND_VERIFIED" || params.lookupStatus === "NOT_FOUND";
}

export function lookupStatusFromResult(
  result: PaymasterLookupResult | null
): PaymasterLookupStatus | "idle" {
  if (!result) return "idle";
  if (result.status === "FOUND_VERIFIED") return "FOUND_VERIFIED";
  return "NOT_FOUND";
}
