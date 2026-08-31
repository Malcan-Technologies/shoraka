import type { PaymasterLookupResult } from "@cashsouk/types";
import {
  customerIdentityLocked,
  customerStepValid,
  isRelatedPartyAnswered,
  isTwelveDigitRegistration,
  newCustomerDetailsUnlocked,
  relatedPartyFieldsVisible,
  registrationLockedAfterLookup,
  showCustomerMasterFields,
  showRegistrationGate,
} from "./customer-paymaster-flow";

describe("customer SSM-first paymaster flow", () => {
  it("starts with a registration gate for add-new before other master fields", () => {
    expect(
      newCustomerDetailsUnlocked({
        customerMode: "new",
        lookupStatus: "idle",
        selectedPaymasterId: "",
        facilityPaymasterLocked: false,
      })
    ).toBe(false);
    expect(
      customerStepValid({
        customerMode: "new",
        selectedPaymasterId: "",
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

  it("unlocks new customer details only after not-found lookup", () => {
    expect(
      newCustomerDetailsUnlocked({
        customerMode: "new",
        lookupStatus: "NOT_FOUND",
        selectedPaymasterId: "",
        facilityPaymasterLocked: false,
      })
    ).toBe(true);
  });

  it("requires explicit related-party yes or no", () => {
    expect(isRelatedPartyAnswered("")).toBe(false);
    expect(isRelatedPartyAnswered("yes")).toBe(true);
    expect(
      customerStepValid({
        customerMode: "new",
        selectedPaymasterId: "",
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

  it("locks master identity after verified selection", () => {
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        customerMode: "existing",
        selectedPaymasterId: "pm_1",
        lookupStatus: "idle",
      })
    ).toBe(true);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        customerMode: "new",
        selectedPaymasterId: "pm_1",
        lookupStatus: "FOUND_VERIFIED",
      })
    ).toBe(true);
  });

  it("keeps related-party independent of master lock helpers", () => {
    expect(isRelatedPartyAnswered("no")).toBe(true);
  });

  it("does not treat unverified lookup as verified reuse", () => {
    expect(
      customerStepValid({
        customerMode: "new",
        selectedPaymasterId: "",
        lookupStatus: "FOUND_UNVERIFIED",
        facilityPaymasterLocked: false,
        name: "Pending Co",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "no",
      })
    ).toBe(true);
    expect(
      customerStepValid({
        customerMode: "existing",
        selectedPaymasterId: "",
        lookupStatus: "idle",
        facilityPaymasterLocked: false,
        name: "Pending Co",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "no",
      })
    ).toBe(false);
  });

  it("locks registration after lookup and keeps it locked for new entry", () => {
    expect(
      registrationLockedAfterLookup({
        facilityPaymasterLocked: false,
        customerMode: "new",
        lookupStatus: "NOT_FOUND",
        selectedPaymasterId: "",
      })
    ).toBe(true);
    expect(isTwelveDigitRegistration("202201234567")).toBe(true);
  });

  it("requires selecting a verified match before continue", () => {
    expect(
      customerStepValid({
        customerMode: "new",
        selectedPaymasterId: "",
        lookupStatus: "FOUND_VERIFIED",
        facilityPaymasterLocked: false,
        name: "Verified Co",
        entityType: "Private Limited Company (Sdn Bhd)",
        ssmNumber: "202201234567",
        country: "MY",
        relatedParty: "no",
      })
    ).toBe(false);
    expect(
      customerStepValid({
        customerMode: "new",
        selectedPaymasterId: "pm_verified",
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

  it("keeps master fields hidden until registration lookup completes", () => {
    expect(
      showRegistrationGate({
        facilityPaymasterLocked: false,
        customerMode: "new",
      })
    ).toBe(true);
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        customerMode: "new",
        selectedPaymasterId: "",
        lookupStatus: "idle",
      })
    ).toBe(false);
    expect(
      relatedPartyFieldsVisible({
        facilityPaymasterLocked: false,
        customerMode: "new",
        selectedPaymasterId: "",
        lookupStatus: "idle",
      })
    ).toBe(false);
  });

  it("shows locked master fields after an unverified match without treating it as verified reuse", () => {
    expect(
      showCustomerMasterFields({
        facilityPaymasterLocked: false,
        customerMode: "new",
        selectedPaymasterId: "",
        lookupStatus: "FOUND_UNVERIFIED",
      })
    ).toBe(true);
    expect(
      customerIdentityLocked({
        stepEditable: true,
        facilityPaymasterLocked: false,
        customerMode: "new",
        selectedPaymasterId: "",
        lookupStatus: "FOUND_UNVERIFIED",
      })
    ).toBe(true);
  });

  it("loads existing draft values when the facility Paymaster is already linked", () => {
    expect(
      customerStepValid({
        customerMode: "new",
        selectedPaymasterId: "",
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

  it("maps lookup API result status", () => {
    const verified: PaymasterLookupResult = {
      status: "FOUND_VERIFIED",
      paymaster: {
        id: "pm_1",
        legalName: "Acme",
        registrationNumber: "202201234567",
        registrationCountry: "MY",
        entityType: "Private Limited Company (Sdn Bhd)",
        verificationStatus: "VERIFIED",
      },
    };
    expect(verified.status).toBe("FOUND_VERIFIED");
  });
});
