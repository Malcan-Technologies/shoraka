import {
  availableFacilityFeeToReserve,
  facilityFeeCollectExceedsUncommitted,
  isChargedFacilityFeeNote,
  reservedFacilityFeeCollectAmount,
  sumReservedFacilityFeeCollections,
  uncommittedFacilityFeeRemaining,
} from "./facility-fee-reservation";

const v1Schedule = (amount: number) => ({
  fee_schedule_version: 1,
  facility_fee_collect_amount: amount,
  additional_fees: [],
});

describe("facility fee collection reservation", () => {
  it("reserves a pending OFFER_SENT v1 amount even before issuer accept", () => {
    expect(
      reservedFacilityFeeCollectAmount(
        { id: "inv-a", status: "OFFER_SENT", offerDetails: v1Schedule(800) },
        null
      )
    ).toBe(800);
  });

  it("blocks two pending offers that together exceed remaining", () => {
    const reserved = sumReservedFacilityFeeCollections({
      invoices: [{ id: "inv-a", status: "OFFER_SENT", offerDetails: v1Schedule(800) }],
      notes: [],
    });
    expect(reserved).toBe(800);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 800,
        remaining: 1_000,
        reserved,
      })
    ).toBe(true);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 200,
        remaining: 1_000,
        reserved,
      })
    ).toBe(false);
  });

  it("excludes the current invoice so a resend does not double-count itself", () => {
    const invoices = [
      { id: "inv-current", status: "OFFER_SENT", offerDetails: v1Schedule(800) },
      { id: "inv-other", status: "OFFER_SENT", offerDetails: v1Schedule(100) },
    ];
    expect(
      sumReservedFacilityFeeCollections({ invoices, notes: [], excludeInvoiceId: "inv-current" })
    ).toBe(100);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 900,
        remaining: 1_000,
        reserved: 100,
      })
    ).toBe(false);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 901,
        remaining: 1_000,
        reserved: 100,
      })
    ).toBe(true);
  });

  it("reserves an accepted live note that has not closed", () => {
    expect(
      reservedFacilityFeeCollectAmount(
        { id: "inv-live", status: "APPROVED", offerDetails: v1Schedule(700) },
        {
          sourceInvoiceId: "inv-live",
          status: "PUBLISHED",
          fundingStatus: "OPEN",
          invoiceSnapshot: { offer_details: v1Schedule(700) },
        }
      )
    ).toBe(700);
    expect(
      reservedFacilityFeeCollectAmount(
        { id: "inv-accepted", status: "APPROVED", offerDetails: v1Schedule(700) },
        null
      )
    ).toBe(700);
  });

  it("releases failed, waived, and already-charged collections", () => {
    const failed = reservedFacilityFeeCollectAmount(
      { id: "inv-fail", status: "APPROVED", offerDetails: v1Schedule(700) },
      { sourceInvoiceId: "inv-fail", status: "FAILED_FUNDING", fundingStatus: "FAILED" }
    );
    const expired = reservedFacilityFeeCollectAmount(
      { id: "inv-exp", status: "OFFER_EXPIRED", offerDetails: v1Schedule(700) },
      null
    );
    const withdrawn = reservedFacilityFeeCollectAmount(
      { id: "inv-wd", status: "WITHDRAWN", offerDetails: v1Schedule(700) },
      null
    );
    const rejected = reservedFacilityFeeCollectAmount(
      { id: "inv-rej", status: "REJECTED", offerDetails: v1Schedule(700) },
      null
    );
    const waived = reservedFacilityFeeCollectAmount(
      { id: "inv-waive", status: "APPROVED", offerDetails: v1Schedule(700) },
      {
        sourceInvoiceId: "inv-waive",
        status: "PUBLISHED",
        fundingStatus: "OPEN",
        invoiceSnapshot: {
          offer_details: v1Schedule(700),
          fee_schedule_overrides: {
            version: 1,
            facility_fee_collection_waived: true,
            waived_reason: "Issuer request",
          },
        },
      }
    );
    const charged = reservedFacilityFeeCollectAmount(
      { id: "inv-charged", status: "APPROVED", offerDetails: v1Schedule(700) },
      { sourceInvoiceId: "inv-charged", status: "FUNDING", fundingStatus: "FUNDED" }
    );
    expect(failed).toBe(0);
    expect(expired).toBe(0);
    expect(withdrawn).toBe(0);
    expect(rejected).toBe(0);
    expect(waived).toBe(0);
    expect(charged).toBe(0);
    expect(isChargedFacilityFeeNote({ status: "FUNDING", fundingStatus: "FUNDED" })).toBe(true);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 1_000,
        remaining: 1_000,
        reserved: failed + waived + charged,
      })
    ).toBe(false);
  });

  it("does not invent a reservation for grandfather invoices without a v1 schedule", () => {
    expect(
      reservedFacilityFeeCollectAmount(
        { id: "inv-gf", status: "APPROVED", offerDetails: { offered_amount: 100_000 } },
        { sourceInvoiceId: "inv-gf", status: "PUBLISHED", fundingStatus: "OPEN" }
      )
    ).toBe(0);
  });

  it("keeps reserved + proposed from exceeding remaining (concurrent-send invariant)", () => {
    const remaining = 1_000;
    const reserved = sumReservedFacilityFeeCollections({
      invoices: [
        { id: "inv-a", status: "OFFER_SENT", offerDetails: v1Schedule(600) },
        { id: "inv-b", status: "APPROVED", offerDetails: v1Schedule(400) },
      ],
      notes: [{ sourceInvoiceId: "inv-b", status: "DRAFT", fundingStatus: "NOT_OPEN" }],
    });
    expect(reserved).toBe(1_000);
    expect(uncommittedFacilityFeeRemaining(remaining, reserved)).toBe(0);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 0.01,
        remaining,
        reserved,
      })
    ).toBe(true);
    expect(
      facilityFeeCollectExceedsUncommitted({
        proposedCollectAmount: 0,
        remaining,
        reserved,
      })
    ).toBe(false);
  });

  it("exposes per-invoice available-to-reserve after sibling reservations", () => {
    const invoices = [
      { id: "inv-a", status: "OFFER_SENT", offerDetails: v1Schedule(800) },
      { id: "inv-b", status: "SUBMITTED", offerDetails: null },
    ];
    expect(
      availableFacilityFeeToReserve({
        remaining: 1_000,
        invoices,
        notes: [],
        excludeInvoiceId: "inv-b",
      })
    ).toBe(200);
  });

  it("excludes the current offer so resend can reuse its own reservation", () => {
    const invoices = [
      { id: "inv-current", status: "OFFER_SENT", offerDetails: v1Schedule(800) },
      { id: "inv-other", status: "OFFER_SENT", offerDetails: v1Schedule(100) },
    ];
    expect(
      availableFacilityFeeToReserve({
        remaining: 1_000,
        invoices,
        notes: [],
        excludeInvoiceId: "inv-current",
      })
    ).toBe(900);
    expect(
      availableFacilityFeeToReserve({
        remaining: 1_000,
        invoices,
        notes: [],
        excludeInvoiceId: "inv-other",
      })
    ).toBe(200);
  });

  it("leaves grandfather progressive collection only the uncommitted remainder", () => {
    const remaining = 1_000;
    const reserved = sumReservedFacilityFeeCollections({
      invoices: [{ id: "inv-v1", status: "OFFER_SENT", offerDetails: v1Schedule(800) }],
      notes: [],
    });
    expect(uncommittedFacilityFeeRemaining(remaining, reserved)).toBe(200);
    expect(Math.min(500, uncommittedFacilityFeeRemaining(remaining, reserved))).toBe(200);
  });
});
