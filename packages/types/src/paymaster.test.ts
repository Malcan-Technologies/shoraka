import {
  isPaymasterIdentityActivityEventType,
  PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES,
} from "./paymaster";

describe("Paymaster identity Activity event types", () => {
  it("is the create, link, and verify set only", () => {
    expect(PAYMASTER_IDENTITY_ACTIVITY_EVENT_TYPES).toEqual([
      "PAYMASTER_CREATED",
      "PAYMASTER_LINKED_TO_ISSUER",
      "PAYMASTER_VERIFIED",
    ]);
    expect(isPaymasterIdentityActivityEventType("PAYMASTER_CREATED")).toBe(true);
    expect(isPaymasterIdentityActivityEventType("PAYMASTER_NOTICE_GENERATED")).toBe(false);
    expect(isPaymasterIdentityActivityEventType("APPLICATION_CREATED")).toBe(false);
  });
});
