import {
  isPaymasterIdentityActivityEventType,
  PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES,
  PAYMASTER_IDENTITY_UNRESOLVED_MESSAGE,
  PAYMASTER_NOT_LINKED_MESSAGE,
  PAYMASTER_NOT_VERIFIED_FOR_OFFER_MESSAGE,
  paymasterIdentityOfferBlockReason,
  submittedIdentityDiffersFromVerified,
} from "./paymaster";

describe("Paymaster identity Activity event types", () => {
  it("is the create, link, verify, and resolve set", () => {
    expect(PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES).toEqual([
      "PAYMASTER_CREATED",
      "PAYMASTER_LINKED_TO_ISSUER",
      "PAYMASTER_VERIFIED",
      "PAYMASTER_IDENTITY_RESOLVED",
    ]);
    expect(isPaymasterIdentityActivityEventType("PAYMASTER_CREATED")).toBe(true);
    expect(isPaymasterIdentityActivityEventType("PAYMASTER_IDENTITY_RESOLVED")).toBe(true);
    expect(isPaymasterIdentityActivityEventType("PAYMASTER_NOTICE_GENERATED")).toBe(false);
    expect(isPaymasterIdentityActivityEventType("APPLICATION_CREATED")).toBe(false);
  });
});

describe("submitted vs verified Paymaster identity", () => {
  const verified = {
    legal_name: "ABC Trading Sdn Bhd",
    entity_type: "Private Limited Company (Sdn Bhd)",
    registration_number: "202134567890",
    registration_country: "MY",
    verification_status: "VERIFIED",
  };

  const matching = {
    name: verified.legal_name,
    entity_type: verified.entity_type,
    ssm_number: verified.registration_number,
    country: verified.registration_country,
  };

  it("is false when the Paymaster is unverified even if names differ", () => {
    expect(
      submittedIdentityDiffersFromVerified({
        submitted: { name: "Other Co", entity_type: verified.entity_type, ssm_number: verified.registration_number, country: "MY" },
        paymaster: { ...verified, verification_status: "UNVERIFIED" },
      })
    ).toBe(false);
  });

  it("is true when verified master identity differs from submitted JSON", () => {
    expect(
      submittedIdentityDiffersFromVerified({
        submitted: {
          name: "Other Co",
          entity_type: verified.entity_type,
          ssm_number: verified.registration_number,
          country: "MY",
        },
        paymaster: verified,
      })
    ).toBe(true);
  });

  it("blocks offers until verified identity matches submitted JSON", () => {
    expect(paymasterIdentityOfferBlockReason({ submitted: {}, paymaster: null })).toBe(
      PAYMASTER_NOT_LINKED_MESSAGE
    );
    expect(
      paymasterIdentityOfferBlockReason({
        submitted: matching,
        paymaster: { ...verified, verification_status: "UNVERIFIED" },
      })
    ).toBe(PAYMASTER_NOT_VERIFIED_FOR_OFFER_MESSAGE);
    expect(
      paymasterIdentityOfferBlockReason({
        submitted: { ...matching, name: "Other Co" },
        paymaster: verified,
      })
    ).toBe(PAYMASTER_IDENTITY_UNRESOLVED_MESSAGE);
    expect(paymasterIdentityOfferBlockReason({ submitted: matching, paymaster: verified })).toBeNull();
  });
});
