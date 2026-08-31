import type { PaymasterLookupResult, PaymasterLookupStatus } from "@cashsouk/types";

export type CustomerMode = "existing" | "new";

export type YesNo = "yes" | "no";

export function isRelatedPartyAnswered(value: string): value is YesNo {
  return value === "yes" || value === "no";
}

export function isTwelveDigitRegistration(value: string): boolean {
  return /^\d{12}$/.test(value);
}

export function customerIdentityLocked(params: {
  stepEditable: boolean;
  facilityPaymasterLocked: boolean;
  customerMode: CustomerMode;
  selectedPaymasterId: string;
  lookupStatus: PaymasterLookupStatus | "idle";
}): boolean {
  if (!params.stepEditable || params.facilityPaymasterLocked) return true;
  if (params.customerMode === "existing" && params.selectedPaymasterId) return true;
  if (params.customerMode === "new" && params.lookupStatus === "FOUND_VERIFIED" && params.selectedPaymasterId) {
    return true;
  }
  if (params.customerMode === "new" && params.lookupStatus === "FOUND_UNVERIFIED") return true;
  return false;
}

export function registrationLockedAfterLookup(params: {
  facilityPaymasterLocked: boolean;
  customerMode: CustomerMode;
  lookupStatus: PaymasterLookupStatus | "idle";
  selectedPaymasterId: string;
}): boolean {
  if (params.facilityPaymasterLocked) return true;
  if (params.customerMode === "existing" && params.selectedPaymasterId) return true;
  if (params.customerMode !== "new") return false;
  return params.lookupStatus !== "idle";
}

export function newCustomerDetailsUnlocked(params: {
  customerMode: CustomerMode;
  lookupStatus: PaymasterLookupStatus | "idle";
  selectedPaymasterId: string;
  facilityPaymasterLocked: boolean;
}): boolean {
  if (params.facilityPaymasterLocked) return false;
  return params.customerMode === "new" && params.lookupStatus === "NOT_FOUND" && !params.selectedPaymasterId;
}

export function showCustomerMasterFields(params: {
  facilityPaymasterLocked: boolean;
  customerMode: CustomerMode;
  selectedPaymasterId: string;
  lookupStatus: PaymasterLookupStatus | "idle";
}): boolean {
  if (params.facilityPaymasterLocked) return true;
  if (params.customerMode === "existing") return Boolean(params.selectedPaymasterId);
  if (params.lookupStatus === "FOUND_UNVERIFIED") return true;
  if (params.lookupStatus === "FOUND_VERIFIED" && params.selectedPaymasterId) return true;
  if (params.lookupStatus === "NOT_FOUND") return true;
  return false;
}

export function relatedPartyFieldsVisible(params: {
  facilityPaymasterLocked: boolean;
  customerMode: CustomerMode;
  selectedPaymasterId: string;
  lookupStatus: PaymasterLookupStatus | "idle";
}): boolean {
  return showCustomerMasterFields(params);
}

export function showRegistrationGate(params: {
  facilityPaymasterLocked: boolean;
  customerMode: CustomerMode;
}): boolean {
  return params.customerMode === "new" && !params.facilityPaymasterLocked;
}

export function customerStepValid(params: {
  customerMode: CustomerMode;
  selectedPaymasterId: string;
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
  if (params.facilityPaymasterLocked) {
    return Boolean(params.name && params.entityType);
  }
  if (params.customerMode === "existing") {
    return Boolean(params.selectedPaymasterId && params.name && params.entityType);
  }
  if (params.lookupStatus === "idle") return false;
  if (params.lookupStatus === "FOUND_VERIFIED") {
    return Boolean(params.selectedPaymasterId && params.name && params.entityType);
  }
  if (params.lookupStatus === "FOUND_UNVERIFIED") {
    return Boolean(params.name && params.entityType);
  }
  return Boolean(params.name && params.entityType);
}

export function lookupStatusFromResult(
  result: PaymasterLookupResult | null
): PaymasterLookupStatus | "idle" {
  return result?.status ?? "idle";
}
