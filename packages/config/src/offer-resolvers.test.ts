import {
  resolveApprovedFacility,
  resolveOfferedAmount,
  resolveOfferedFacility,
  resolveRequestedFacility,
  resolveRequestedInvoiceAmount,
} from "./offer-resolvers";

describe("resolveApprovedFacility", () => {
  it("keeps a numeric-string approved line on APPROVED contracts", () => {
    expect(resolveApprovedFacility("APPROVED", { approved_facility: "100000" })).toBe(100000);
    expect(resolveApprovedFacility("APPROVED", { approved_facility: "RM 100,000.00" })).toBe(100000);
  });

  it("returns 0 unless the contract is APPROVED", () => {
    expect(resolveApprovedFacility("OFFER_SENT", { approved_facility: 100000 })).toBe(0);
  });

  it("keeps the accepted ceiling while the facility itself is in amendment", () => {
    expect(resolveApprovedFacility("AMENDMENT_REQUESTED", { approved_facility: 100000 })).toBe(100000);
  });
});

describe("resolveOfferedFacility", () => {
  it("parses numeric strings", () => {
    expect(resolveOfferedFacility({ offered_facility: "250000" })).toBe(250000);
  });
});

describe("resolveOfferedAmount", () => {
  it("parses numeric strings", () => {
    expect(resolveOfferedAmount({ offered_amount: "40740" })).toBe(40740);
    expect(resolveOfferedAmount({ offered_amount: "100,000" })).toBe(100000);
  });
});

describe("resolveRequestedInvoiceAmount", () => {
  it("prefers applied_financing over face times ratio", () => {
    expect(
      resolveRequestedInvoiceAmount({
        value: 100_000,
        financing_ratio_percent: 80,
        applied_financing: 40_000,
      })
    ).toBe(40_000);
  });

  it("falls back to face times ratio when requested keys are absent", () => {
    expect(
      resolveRequestedInvoiceAmount({
        value: 100_000,
        financing_ratio_percent: 80,
      })
    ).toBe(80_000);
  });
});

describe("resolveRequestedFacility", () => {
  it("parses numeric strings from requested keys", () => {
    expect(resolveRequestedFacility({ financing: "50000" })).toBe(50000);
  });

  it("prefers financing then facility_applied when value keys are omitted", () => {
    expect(
      resolveRequestedFacility({ financing: "100,000", facility_applied: "90,000" })
    ).toBe(100000);
    expect(resolveRequestedFacility({ facility_applied: "90,000" })).toBe(90000);
  });
});
