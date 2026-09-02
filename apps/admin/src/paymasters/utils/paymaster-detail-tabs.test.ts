import { isPaymasterDetailTabId, paymasterIdentityTabStatus } from "./paymaster-detail-tabs";

describe("isPaymasterDetailTabId", () => {
  it("accepts identity, linked-records, and activity", () => {
    expect(isPaymasterDetailTabId("identity")).toBe(true);
    expect(isPaymasterDetailTabId("linked-records")).toBe(true);
    expect(isPaymasterDetailTabId("activity")).toBe(true);
  });

  it("rejects unknown tab ids", () => {
    expect(isPaymasterDetailTabId("organization")).toBe(false);
    expect(isPaymasterDetailTabId("")).toBe(false);
  });
});

describe("paymasterIdentityTabStatus", () => {
  it("marks unverified identity as action and verified as success", () => {
    expect(paymasterIdentityTabStatus("UNVERIFIED")).toEqual({
      statusToken: "action",
      statusLabel: "Needs action",
    });
    expect(paymasterIdentityTabStatus("VERIFIED")).toEqual({
      statusToken: "success",
      statusLabel: "Done",
    });
  });
});
