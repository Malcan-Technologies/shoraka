import type { PaymasterLookupResult } from "@cashsouk/types";
import {
  customerIdentityLocked,
  customerStepValid,
  isFacilityPaymasterLocked,
  isRelatedPartyAnswered,
  isTwelveDigitRegistration,
  isVerifiedPaymasterLookup,
  lookupStatusFromResult,
  relatedPartyFieldsVisible,
  showCustomerMasterFields,
} from "./customer-paymaster-flow";

describe("customer SSM-first paymaster flow", () => {
  it("keeps master fields hidden until a 12-digit SSM has been looked up", () => {
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        lookupStatus: "idle",
        ssmNumber: "202201234567",
      })
    ).toBe(false);
    expect(
      relatedPartyFieldsVisible({
        facilityPaymasterLocked: false,
        lookupStatus: "idle",
        ssmNumber: "202201234567",
      })
    ).toBe(false);
    expect(
      customerStepValid({
        lookupStatus: "idle",
        facilityPaymasterLocked: false,
        name: "Acme",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "no",
      })
    ).toBe(false);
  });

  it("unlocks identity fields after no verified Paymaster is found", () => {
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        lookupStatus: "NOT_FOUND",
        ssmNumber: "202201234567",
      })
    ).toBe(true);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "NOT_FOUND",
      })
    ).toBe(false);
  });

  it("requires an explicit related-party yes or no", () => {
    expect(isRelatedPartyAnswered("")).toBe(false);
    expect(isRelatedPartyAnswered("yes")).toBe(true);
    expect(
      customerStepValid({
        lookupStatus: "NOT_FOUND",
        facilityPaymasterLocked: false,
        name: "Acme",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "",
      })
    ).toBe(false);
  });

  it("locks master identity after a verified lookup", () => {
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "FOUND_VERIFIED",
      })
    ).toBe(true);
    expect(
      customerStepValid({
        lookupStatus: "FOUND_VERIFIED",
        facilityPaymasterLocked: false,
        name: "Verified Co",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "no",
      })
    ).toBe(true);
  });

  it("treats unverified lookup as not found for issuer identity", () => {
    const unverified: PaymasterLookupResult = {
      status: "FOUND_UNVERIFIED",
      paymaster: {
        id: "pm_1",
        legalName: "Pending Co",
        registrationNumber: "202201234567",
        registrationCountry: "MY",
        entityType: "Private Limited Company (Sdn Bhd)",
        verificationStatus: "UNVERIFIED",
      },
    };
    expect(lookupStatusFromResult(unverified)).toBe("NOT_FOUND");
    expect(isTwelveDigitRegistration("202201234567")).toBe(true);
    expect(isVerifiedPaymasterLookup("FOUND_UNVERIFIED")).toBe(false);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "FOUND_UNVERIFIED",
      })
    ).toBe(false);
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        lookupStatus: "FOUND_UNVERIFIED",
        ssmNumber: "202201234567",
      })
    ).toBe(true);
  });

  it("keeps related-party visible when verified identity is locked", () => {
    expect(isVerifiedPaymasterLookup("FOUND_VERIFIED")).toBe(true);
    expect(
      relatedPartyFieldsVisible({
        facilityPaymasterLocked: false,
        lookupStatus: "FOUND_VERIFIED",
        ssmNumber: "202201234567",
      })
    ).toBe(true);
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        lookupStatus: "FOUND_VERIFIED",
        ssmNumber: "202201234567",
      })
    ).toBe(true);
  });

  it("locks identity on an approved facility even before lookup", () => {
    expect(isFacilityPaymasterLocked("APPROVED")).toBe(true);
    expect(isFacilityPaymasterLocked("DRAFT")).toBe(false);
    expect(isFacilityPaymasterLocked("AMENDMENT_REQUESTED")).toBe(false);
    expect(
      customerStepValid({
        lookupStatus: "idle",
        facilityPaymasterLocked: true,
        name: "Draft Co",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "yes",
      })
    ).toBe(true);
  });
});
