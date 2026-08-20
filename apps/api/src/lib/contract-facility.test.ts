import {
  computeContractFacilitySnapshot,
  isFacilityNoteDrawnAtFundedAmount,
  isReleasedFacilityNote,
  parseFacilityJsonAmount,
  resolveApprovedFacilityForRefresh,
  resolveInvoiceFacilityAmount,
  resolveInvoiceOccupancyAmount,
} from "./contract-facility";

describe("resolveApprovedFacilityForRefresh", () => {
  it("keeps a numeric-string approved line on APPROVED contracts", () => {
    expect(
      resolveApprovedFacilityForRefresh("APPROVED", { approved_facility: "100000" })
    ).toBe(100000);
    expect(
      resolveApprovedFacilityForRefresh("APPROVED", { approved_facility: "100,000" })
    ).toBe(100000);
  });

  it("returns 0 unless the contract is APPROVED", () => {
    expect(
      resolveApprovedFacilityForRefresh("OFFER_SENT", { approved_facility: 100000 })
    ).toBe(0);
  });

  it("keeps the accepted ceiling while the facility itself is in amendment", () => {
    expect(
      resolveApprovedFacilityForRefresh("AMENDMENT_REQUESTED", { approved_facility: 100_000 })
    ).toBe(100_000);
    expect(
      resolveApprovedFacilityForRefresh("AMENDMENT_REQUESTED", { approved_facility: "RM 100,000.00" })
    ).toBe(100_000);
  });
});

describe("parseFacilityJsonAmount", () => {
  it("parses comma-formatted occupancy strings including negatives", () => {
    expect(parseFacilityJsonAmount("250,000")).toBe(250000);
    expect(parseFacilityJsonAmount("-30,000")).toBe(-30000);
    expect(parseFacilityJsonAmount(0)).toBe(0);
  });

  it("parses currency-prefixed strings used in contract JSON", () => {
    expect(parseFacilityJsonAmount("RM 250,000.00")).toBe(250000);
    expect(parseFacilityJsonAmount("RM 100,000")).toBe(100000);
  });
});

describe("resolveInvoiceFacilityAmount", () => {
  it("prefers offered_amount over value × ratio", () => {
    expect(
      resolveInvoiceFacilityAmount({
        details: { value: 289000, financing_ratio_percent: 74 },
        offer_details: { offered_amount: 205190 },
      })
    ).toBe(205190);
  });

  it("falls back to requested value × ratio", () => {
    expect(
      resolveInvoiceFacilityAmount({
        details: { value: 5000000, financing_ratio_percent: 76 },
        offer_details: null,
      })
    ).toBe(3_800_000);
  });
});

describe("isReleasedFacilityNote", () => {
  it("releases repaid, failed, cancelled, and settled servicing", () => {
    expect(isReleasedFacilityNote({ status: "REPAID" })).toBe(true);
    expect(isReleasedFacilityNote({ status: "FAILED_FUNDING" })).toBe(true);
    expect(isReleasedFacilityNote({ status: "CANCELLED" })).toBe(true);
    expect(isReleasedFacilityNote({ status: "ACTIVE", servicingStatus: "SETTLED" })).toBe(true);
    expect(isReleasedFacilityNote({ status: "ACTIVE", servicingStatus: "CURRENT" })).toBe(false);
    expect(isReleasedFacilityNote(null)).toBe(false);
  });
});

describe("resolveInvoiceOccupancyAmount", () => {
  it("reserves the committed advance while the note is still raising", () => {
    expect(
      resolveInvoiceOccupancyAmount({
        offer_details: { offered_amount: 200_000 },
        note: {
          status: "PUBLISHED",
          fundingStatus: "OPEN",
          fundedAmount: 50_000,
          targetAmount: 200_000,
        },
      })
    ).toBe(200_000);
  });

  it("true-ups to funded principal of 0 after a successful close with nothing funded", () => {
    expect(
      resolveInvoiceOccupancyAmount({
        offer_details: { offered_amount: 200_000 },
        note: {
          status: "FUNDING",
          fundingStatus: "FUNDED",
          fundedAmount: 0,
          targetAmount: 200_000,
        },
      })
    ).toBe(0);
  });

  it("true-ups to funded principal after funding closes below target", () => {
    expect(
      resolveInvoiceOccupancyAmount({
        offer_details: { offered_amount: 200_000 },
        note: {
          status: "ACTIVE",
          fundingStatus: "FUNDED",
          servicingStatus: "CURRENT",
          fundedAmount: 180_000,
          targetAmount: 200_000,
        },
      })
    ).toBe(180_000);
  });

  it("treats FUNDING / FUNDED (pre-activation) as drawn at funded amount", () => {
    expect(
      isFacilityNoteDrawnAtFundedAmount({
        status: "FUNDING",
        fundingStatus: "FUNDED",
        fundedAmount: 180_000,
      })
    ).toBe(true);
    expect(
      resolveInvoiceOccupancyAmount({
        offer_details: { offered_amount: 200_000 },
        note: { status: "FUNDING", fundingStatus: "FUNDED", fundedAmount: 180_000 },
      })
    ).toBe(180_000);
  });
});

describe("computeContractFacilitySnapshot", () => {
  it("reproduces Mining Rig Repair 1234 as revolving occupancy", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 100_000 },
      [
        {
          status: "APPROVED",
          details: { value: 289000, financing_ratio_percent: 74 },
          offer_details: { offered_amount: 205190 },
          note: {
            status: "REPAID",
            servicingStatus: "SETTLED",
            fundingStatus: "FUNDED",
            fundedAmount: 178_000,
            targetAmount: 205190,
          },
        },
        {
          status: "SUBMITTED",
          details: { value: 5_000_000, financing_ratio_percent: 76 },
          offer_details: null,
        },
        {
          status: "SUBMITTED",
          details: { value: 67900, financing_ratio_percent: 68 },
          offer_details: null,
        },
      ]
    );

    expect(snapshot).toEqual({
      approvedFacility: 100_000,
      utilizedFacility: 0,
      repaidFacility: 178_000,
      pendingFacility: 3_800_000 + 46_172,
      availableFacility: 100_000,
    });
  });

  it("occupies only funded principal on a live note that closed below target", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 200_000 },
      [
        {
          status: "APPROVED",
          offer_details: { offered_amount: 200_000 },
          note: {
            status: "ACTIVE",
            fundingStatus: "FUNDED",
            fundedAmount: 180_000,
            targetAmount: 200_000,
          },
        },
      ]
    );

    expect(snapshot.utilizedFacility).toBe(180_000);
    expect(snapshot.availableFacility).toBe(20_000);
  });

  it("keeps a live approved invoice in utilized even when pending invoices exist", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 100_000 },
      [
        {
          status: "APPROVED",
          offer_details: { offered_amount: 40_000 },
          note: { status: "ACTIVE", servicingStatus: "CURRENT", fundingStatus: "FUNDED", fundedAmount: 40_000 },
        },
        {
          status: "OFFER_SENT",
          offer_details: { offered_amount: 80_000 },
        },
      ]
    );

    expect(snapshot.utilizedFacility).toBe(40_000);
    expect(snapshot.pendingFacility).toBe(80_000);
    expect(snapshot.availableFacility).toBe(60_000);
  });

  it("allows negative available when a live draw exceeds the approved line", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 100_000 },
      [
        {
          status: "APPROVED",
          offer_details: { offered_amount: 205190 },
          note: { status: "ACTIVE", fundingStatus: "FUNDED", fundedAmount: 205190 },
        },
      ]
    );

    expect(snapshot.utilizedFacility).toBe(205190);
    expect(snapshot.availableFacility).toBe(100_000 - 205190);
  });

  it("treats an approved invoice with no note as still occupying the committed advance", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 100_000 },
      [{ status: "APPROVED", offer_details: { offered_amount: 25_000 } }]
    );
    expect(snapshot.utilizedFacility).toBe(25_000);
    expect(snapshot.repaidFacility).toBe(0);
  });

  it("releases failed funding without counting it as repaid", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 100_000 },
      [
        {
          status: "APPROVED",
          offer_details: { offered_amount: 80_000 },
          note: { status: "FAILED_FUNDING", fundingStatus: "FAILED", fundedAmount: 10_000 },
        },
      ]
    );
    expect(snapshot.utilizedFacility).toBe(0);
    expect(snapshot.repaidFacility).toBe(0);
    expect(snapshot.availableFacility).toBe(100_000);
  });

  it("keeps pre-approval amendment invoices in pending, not utilized", () => {
    const snapshot = computeContractFacilitySnapshot(
      "APPROVED",
      { approved_facility: 100_000 },
      [
        {
          status: "AMENDMENT_REQUESTED",
          offer_details: { offered_amount: 80_000 },
        },
      ]
    );
    expect(snapshot.pendingFacility).toBe(80_000);
    expect(snapshot.utilizedFacility).toBe(0);
    expect(snapshot.availableFacility).toBe(100_000);
  });

  it("does not wipe the approved ceiling when the facility contract is in amendment", () => {
    const snapshot = computeContractFacilitySnapshot(
      "AMENDMENT_REQUESTED",
      { approved_facility: 100_000 },
      [
        {
          status: "APPROVED",
          offer_details: { offered_amount: 40_000 },
          note: { status: "ACTIVE", fundingStatus: "FUNDED", fundedAmount: 40_000 },
        },
      ]
    );
    expect(snapshot.approvedFacility).toBe(100_000);
    expect(snapshot.utilizedFacility).toBe(40_000);
    expect(snapshot.availableFacility).toBe(60_000);
  });
});
