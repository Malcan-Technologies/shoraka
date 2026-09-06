import type { PaymasterLookupResult } from "@cashsouk/types";
import {
  customerIdentityLocked,
  customerStepValid,
  isFacilityPaymasterLocked,
  isRelatedPartyAnswered,
  isTwelveDigitRegistration,
  isVerifiedPaymasterLookup,
  linkedPaymasterSameSsm,
  lookupStatusFromResult,
  readLinkedPaymasterFromContract,
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

  it("keeps verified identity locked during amendment of the same SSM", () => {
    expect(isFacilityPaymasterLocked("AMENDMENT_REQUESTED")).toBe(false);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "FOUND_VERIFIED",
      })
    ).toBe(true);
  });

  it("locks verified identity immediately even while lookup is idle or failed", () => {
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "idle",
        linkedVerifiedSameSsm: true,
      })
    ).toBe(true);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "NOT_FOUND",
        linkedVerifiedSameSsm: true,
      })
    ).toBe(true);
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        lookupStatus: "idle",
        ssmNumber: "202201234567",
        linkedSameSsm: true,
      })
    ).toBe(true);
    expect(
      customerStepValid({
        lookupStatus: "idle",
        facilityPaymasterLocked: false,
        name: "Verified Co",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "no",
        linkedSameSsm: true,
      })
    ).toBe(true);
  });

  it("does not lock identity for an unverified linked Paymaster while lookup is idle", () => {
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "idle",
        linkedVerifiedSameSsm: false,
      })
    ).toBe(false);
  });

  it("unlocks verified identity only after a deliberate SSM switch", () => {
    expect(
      linkedPaymasterSameSsm({
        linkedRegistrationNumber: "202201234567",
        ssmNumber: "202201234567",
      })
    ).toBe(true);
    expect(
      linkedPaymasterSameSsm({
        linkedRegistrationNumber: "202201234567",
        ssmNumber: "111111111111",
      })
    ).toBe(false);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        lookupStatus: "idle",
        linkedVerifiedSameSsm: false,
      })
    ).toBe(false);
  });

  it("reads linked verified Paymaster from the contract payload", () => {
    expect(
      readLinkedPaymasterFromContract({
        paymaster: {
          verification_status: "VERIFIED",
          registration_number: "202201234567",
        },
      })
    ).toEqual({ verified: true, registrationNumber: "202201234567" });
    expect(
      readLinkedPaymasterFromContract({
        paymaster: {
          verificationStatus: "UNVERIFIED",
          registrationNumber: "202201234567",
        },
      })
    ).toEqual({ verified: false, registrationNumber: "202201234567" });
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

  it("treats unverified lookup as found without locking identity fields", () => {
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
    expect(lookupStatusFromResult(unverified)).toBe("FOUND_UNVERIFIED");
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

  it("locks SSM after offer even when the holder contract is still draft", () => {
    expect(
      isFacilityPaymasterLocked("DRAFT", {
        applicationStatus: "INVOICES_SENT",
        invoiceStatuses: ["OFFER_SENT"],
      })
    ).toBe(true);
    expect(
      isFacilityPaymasterLocked("OFFER_SENT", {
        applicationStatus: "CONTRACT_SENT",
      })
    ).toBe(true);
    expect(
      isFacilityPaymasterLocked("AMENDMENT_REQUESTED", {
        applicationStatus: "AMENDMENT_REQUESTED",
      })
    ).toBe(false);
  });
});
