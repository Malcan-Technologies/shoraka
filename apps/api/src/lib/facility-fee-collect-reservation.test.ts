import { AppError } from "./http/error-handler";
import {
  assertFacilityLinkedInvoiceAcceptFees,
  assertFacilityLinkedInvoiceOfferFees,
  assertFrozenFacilityFeeCollectable,
  assertInvoiceFeeScheduleChargeable,
  settleCloseFundingFacilityFees,
} from "./facility-fee-collect-reservation";

const v1Schedule = (amount: number) => ({
  fee_schedule_version: 1,
  facility_fee_collect_amount: amount,
  additional_fees: [],
});

const enabledDetails = {
  facility_enabled: true,
  facility_fee_total_amount: 1_000,
  facility_fee_paid_amount: 0,
};

function createTx(options?: {
  invoices?: Array<{ id: string; status: string; offer_details: unknown }>;
  notes?: Array<{
    source_invoice_id: string;
    status: string;
    funding_status: string;
    servicing_status?: string;
    invoice_snapshot: unknown;
  }>;
}) {
  const order: string[] = [];
  const tx = {
    $queryRaw: jest.fn(async () => {
      order.push("lock");
      return [];
    }),
    invoice: {
      findMany: jest.fn(async () => {
        order.push("read-invoices");
        return options?.invoices ?? [];
      }),
    },
    note: {
      findMany: jest.fn(async () => {
        order.push("read-notes");
        return options?.notes ?? [];
      }),
    },
  };
  return { tx, order };
}

describe("assertFacilityLinkedInvoiceOfferFees", () => {
  it("rejects facility-linked offers while the contract is disabled", async () => {
    const { tx } = createTx();
    await expect(
      assertFacilityLinkedInvoiceOfferFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-new",
        proposedCollectAmount: 0,
        contractDetails: { facility_enabled: false, facility_disabled_reason: "Paused" },
      })
    ).rejects.toMatchObject({
      code: "FACILITY_DISABLED",
    } satisfies Partial<AppError>);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("locks sibling invoices and notes before reading reserved collections", async () => {
    const { tx, order } = createTx({
      invoices: [{ id: "inv-a", status: "OFFER_SENT", offer_details: v1Schedule(800) }],
    });
    await expect(
      assertFacilityLinkedInvoiceOfferFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-new",
        proposedCollectAmount: 100,
        contractDetails: enabledDetails,
      })
    ).resolves.toBeUndefined();
    expect(order).toEqual(["lock", "lock", "read-invoices", "read-notes"]);
    expect(tx.$queryRaw.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([expect.stringContaining("FOR UPDATE")]));
    expect(tx.$queryRaw.mock.calls[1]?.[0]).toEqual(expect.arrayContaining([expect.stringContaining("FOR UPDATE")]));
  });

  it("rejects when a pending sibling offer would overcommit remaining", async () => {
    const { tx } = createTx({
      invoices: [{ id: "inv-a", status: "OFFER_SENT", offer_details: v1Schedule(800) }],
    });
    await expect(
      assertFacilityLinkedInvoiceOfferFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-new",
        proposedCollectAmount: 800,
        contractDetails: enabledDetails,
      })
    ).rejects.toMatchObject({
      code: "FACILITY_FEE_COLLECT_EXCEEDS_REMAINING",
      message: "Facility fee collection cannot exceed the facility fee available for this offer of 200.00",
    });
  });

  it("ignores the current invoice's existing amount on resend", async () => {
    const { tx } = createTx({
      invoices: [{ id: "inv-current", status: "OFFER_SENT", offer_details: v1Schedule(800) }],
    });
    await expect(
      assertFacilityLinkedInvoiceOfferFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-current",
        proposedCollectAmount: 1_000,
        contractDetails: enabledDetails,
      })
    ).resolves.toBeUndefined();
  });

  it("counts an accepted live note and releases failed, waived, and charged items", async () => {
    const live = createTx({
      invoices: [{ id: "inv-live", status: "APPROVED", offer_details: v1Schedule(700) }],
      notes: [
        {
          source_invoice_id: "inv-live",
          status: "PUBLISHED",
          funding_status: "OPEN",
          invoice_snapshot: { offer_details: v1Schedule(700) },
        },
      ],
    });
    await expect(
      assertFacilityLinkedInvoiceOfferFees(live.tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-new",
        proposedCollectAmount: 400,
        contractDetails: enabledDetails,
      })
    ).rejects.toMatchObject({ code: "FACILITY_FEE_COLLECT_EXCEEDS_REMAINING" });

    const released = createTx({
      invoices: [
        { id: "inv-fail", status: "APPROVED", offer_details: v1Schedule(700) },
        { id: "inv-waive", status: "APPROVED", offer_details: v1Schedule(700) },
        { id: "inv-charged", status: "APPROVED", offer_details: v1Schedule(700) },
      ],
      notes: [
        {
          source_invoice_id: "inv-fail",
          status: "FAILED_FUNDING",
          funding_status: "FAILED",
          invoice_snapshot: {},
        },
        {
          source_invoice_id: "inv-waive",
          status: "PUBLISHED",
          funding_status: "OPEN",
          invoice_snapshot: {
            fee_schedule_overrides: { version: 1, facility_fee_collection_waived: true },
          },
        },
        {
          source_invoice_id: "inv-charged",
          status: "FUNDING",
          funding_status: "FUNDED",
          invoice_snapshot: {},
        },
      ],
    });
    await expect(
      assertFacilityLinkedInvoiceOfferFees(released.tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-new",
        proposedCollectAmount: 1_000,
        contractDetails: enabledDetails,
      })
    ).resolves.toBeUndefined();
  });
});

describe("assertFacilityLinkedInvoiceAcceptFees", () => {
  it("rejects accept while the facility is disabled", async () => {
    const { tx } = createTx();
    await expect(
      assertFacilityLinkedInvoiceAcceptFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-open",
        proposedCollectAmount: 0,
        contractDetails: { facility_enabled: false, facility_disabled_reason: "Paused" },
      })
    ).rejects.toMatchObject({ code: "FACILITY_DISABLED" });
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("allows accept after remaining facility fee was waived", async () => {
    const { tx } = createTx({
      invoices: [{ id: "inv-open", status: "OFFER_SENT", offer_details: v1Schedule(800) }],
    });
    await expect(
      assertFacilityLinkedInvoiceAcceptFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-open",
        proposedCollectAmount: 800,
        contractDetails: {
          ...enabledDetails,
          facility_fee_waived: true,
          facility_fee_waived_amount: 1_000,
        },
      })
    ).resolves.toBeUndefined();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects accept when remaining cannot cover this invoice after siblings", async () => {
    const { tx } = createTx({
      invoices: [{ id: "inv-sib", status: "OFFER_SENT", offer_details: v1Schedule(800) }],
    });
    await expect(
      assertFacilityLinkedInvoiceAcceptFees(tx as never, {
        contractId: "contract-1",
        currentInvoiceId: "inv-open",
        proposedCollectAmount: 400,
        contractDetails: enabledDetails,
      })
    ).rejects.toMatchObject({ code: "FACILITY_FEE_COLLECT_EXCEEDS_REMAINING" });
  });
});

function sqlText(arg: unknown): string {
  if (Array.isArray(arg)) return arg.join(" ");
  if (arg && typeof arg === "object" && "strings" in arg) {
    const strings = (arg as { strings?: unknown }).strings;
    if (Array.isArray(strings)) return strings.join(" ");
  }
  return String(arg ?? "");
}

const closeInput = {
  contractId: "contract-1",
  fundedAmount: 50_000,
  platformFeeRatePercent: 0,
  approvedFacilityAmount: 200_000,
  facilityFeeRatePercent: 1,
  facilityFeePaidBefore: 0,
  contractDetails: enabledDetails,
};

describe("assertInvoiceFeeScheduleChargeable", () => {
  it("allows a valid or missing schedule and rejects a damaged v1 schedule", () => {
    expect(() => assertInvoiceFeeScheduleChargeable({ offered_amount: 50_000 })).not.toThrow();
    expect(() => assertInvoiceFeeScheduleChargeable(v1Schedule(800))).not.toThrow();
    expect(() =>
      assertInvoiceFeeScheduleChargeable({
        fee_schedule_version: 1,
        facility_fee_collect_amount: -1,
      })
    ).toThrow(AppError);
  });
});

describe("assertFrozenFacilityFeeCollectable", () => {
  it("skips when note or contract waiver zeros collection", () => {
    expect(() =>
      assertFrozenFacilityFeeCollectable({
        frozenCollectAmount: 800,
        remaining: 100,
        noteWaived: true,
      })
    ).not.toThrow();
    expect(() =>
      assertFrozenFacilityFeeCollectable({
        frozenCollectAmount: 800,
        remaining: 0,
        contractWaived: true,
      })
    ).not.toThrow();
  });

  it("hard-fails when remaining is below an un-waived frozen collection", () => {
    expect(() =>
      assertFrozenFacilityFeeCollectable({
        frozenCollectAmount: 800,
        remaining: 200,
      })
    ).toThrow(AppError);
    try {
      assertFrozenFacilityFeeCollectable({ frozenCollectAmount: 800, remaining: 200 });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe("FACILITY_FEE_FROZEN_COLLECT_INVARIANT");
      expect((error as AppError).statusCode).toBe(409);
    }
  });
});

describe("settleCloseFundingFacilityFees", () => {
  it("locks invoices then notes under the existing contract lock order", async () => {
    const { tx, order } = createTx();
    await settleCloseFundingFacilityFees(tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-gf",
      offerDetails: { offered_amount: 50_000 },
    });
    expect(order).toEqual(["lock", "lock", "read-invoices", "read-notes"]);
    expect(sqlText(tx.$queryRaw.mock.calls[0]?.[0])).toContain("FROM invoices");
    expect(sqlText(tx.$queryRaw.mock.calls[0]?.[0])).toContain("FOR UPDATE");
    expect(sqlText(tx.$queryRaw.mock.calls[1]?.[0])).toContain("FROM notes");
    expect(sqlText(tx.$queryRaw.mock.calls[1]?.[0])).toContain("FOR UPDATE");
  });

  it("caps a grandfather close by a pending v1 reservation", async () => {
    const { tx } = createTx({
      invoices: [
        { id: "inv-gf", status: "APPROVED", offer_details: { offered_amount: 50_000 } },
        { id: "inv-v1", status: "OFFER_SENT", offer_details: v1Schedule(800) },
      ],
    });
    const settled = await settleCloseFundingFacilityFees(tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-gf",
      offerDetails: { offered_amount: 50_000 },
    });
    expect(settled.mode).toBe("grandfather");
    expect(settled.facilityFeeCharged).toBe(200);
    expect(settled.facilityFeePaidBefore).toBe(0);
    expect(settled.facilityFeeRemainingAfter).toBe(800);
    expect(settled.netDisbursement).toBe(49_800);
    expect(settled.facilityFeePaidBefore + settled.facilityFeeCharged).toBe(200);
    expect(settled.facilityFeeRemainingAfter + settled.facilityFeeCharged).toBe(1_000);
  });

  it("caps a grandfather close by an accepted live v1 reservation", async () => {
    const { tx } = createTx({
      invoices: [
        { id: "inv-gf", status: "APPROVED", offer_details: { offered_amount: 50_000 } },
        { id: "inv-v1", status: "APPROVED", offer_details: v1Schedule(700) },
      ],
      notes: [
        {
          source_invoice_id: "inv-v1",
          status: "PUBLISHED",
          funding_status: "OPEN",
          invoice_snapshot: { offer_details: v1Schedule(700) },
        },
      ],
    });
    const settled = await settleCloseFundingFacilityFees(tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-gf",
      offerDetails: { offered_amount: 50_000 },
    });
    expect(settled.facilityFeeCharged).toBe(300);
    expect(settled.facilityFeeRemainingAfter).toBe(700);
  });

  it("charges a v1 close exactly after a grandfather close left the reserved remainder", async () => {
    const afterGrandfather = createTx({
      invoices: [
        { id: "inv-gf", status: "APPROVED", offer_details: { offered_amount: 50_000 } },
        { id: "inv-v1", status: "APPROVED", offer_details: v1Schedule(800) },
      ],
      notes: [
        {
          source_invoice_id: "inv-gf",
          status: "FUNDING",
          funding_status: "FUNDED",
          invoice_snapshot: {},
        },
        {
          source_invoice_id: "inv-v1",
          status: "PUBLISHED",
          funding_status: "OPEN",
          invoice_snapshot: { offer_details: v1Schedule(800) },
        },
      ],
    });
    const settled = await settleCloseFundingFacilityFees(afterGrandfather.tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-v1",
      fundedAmount: 80_000,
      facilityFeePaidBefore: 200,
      contractDetails: { ...enabledDetails, facility_fee_paid_amount: 200 },
      offerDetails: v1Schedule(800),
    });
    expect(settled.mode).toBe("schedule");
    expect(settled.facilityFeeCharged).toBe(800);
    expect(settled.facilityFeePaidBefore).toBe(200);
    expect(settled.facilityFeeRemainingAfter).toBe(0);
    expect(settled.facilityFeePaidBefore + settled.facilityFeeCharged).toBe(1_000);
    expect(settled.netDisbursement).toBe(79_200);
  });

  it("lets grandfather consume remaining after a waived or released v1 reservation", async () => {
    const waived = createTx({
      invoices: [
        { id: "inv-gf", status: "APPROVED", offer_details: { offered_amount: 50_000 } },
        { id: "inv-v1", status: "APPROVED", offer_details: v1Schedule(800) },
      ],
      notes: [
        {
          source_invoice_id: "inv-v1",
          status: "PUBLISHED",
          funding_status: "OPEN",
          invoice_snapshot: {
            fee_schedule_overrides: { version: 1, facility_fee_collection_waived: true },
          },
        },
      ],
    });
    const waivedSettled = await settleCloseFundingFacilityFees(waived.tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-gf",
      offerDetails: { offered_amount: 50_000 },
    });
    expect(waivedSettled.facilityFeeCharged).toBe(500);
    expect(waivedSettled.facilityFeeRemainingAfter).toBe(500);

    const released = createTx({
      invoices: [
        { id: "inv-gf", status: "APPROVED", offer_details: { offered_amount: 50_000 } },
        { id: "inv-v1", status: "APPROVED", offer_details: v1Schedule(800) },
      ],
      notes: [
        {
          source_invoice_id: "inv-v1",
          status: "FAILED_FUNDING",
          funding_status: "FAILED",
          invoice_snapshot: { offer_details: v1Schedule(800) },
        },
      ],
    });
    const releasedSettled = await settleCloseFundingFacilityFees(released.tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-gf",
      offerDetails: { offered_amount: 50_000 },
    });
    expect(releasedSettled.facilityFeeCharged).toBe(500);
  });

  it("zeros a waived v1 close without consuming remaining", async () => {
    const { tx } = createTx();
    const settled = await settleCloseFundingFacilityFees(tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-v1",
      offerDetails: v1Schedule(800),
      invoiceSnapshot: {
        fee_schedule_overrides: {
          version: 1,
          facility_fee_collection_waived: true,
          waived_reason: "Issuer request",
        },
      },
    });
    expect(settled.facilityFeeCharged).toBe(0);
    expect(settled.facilityFeeCollectionWaived).toBe(true);
    expect(settled.facilityFeeRemainingAfter).toBe(1_000);
  });

  it("zeros a contract-waived v1 close without failing the frozen invariant", async () => {
    const { tx } = createTx();
    const settled = await settleCloseFundingFacilityFees(tx as never, {
      ...closeInput,
      currentInvoiceId: "inv-v1",
      facilityFeePaidBefore: 200,
      contractDetails: {
        ...enabledDetails,
        facility_fee_paid_amount: 200,
        facility_fee_waived: true,
        facility_fee_waived_amount: 800,
      },
      offerDetails: v1Schedule(800),
    });
    expect(settled.facilityFeeCharged).toBe(0);
    expect(settled.contractFacilityFeeWaived).toBe(true);
    expect(settled.facilityFeeRemainingAfter).toBe(0);
  });

  it("hard-fails a corrupted v1 close instead of charging less than frozen", async () => {
    const { tx } = createTx();
    await expect(
      settleCloseFundingFacilityFees(tx as never, {
        ...closeInput,
        currentInvoiceId: "inv-v1",
        facilityFeePaidBefore: 500,
        contractDetails: { ...enabledDetails, facility_fee_paid_amount: 500 },
        offerDetails: v1Schedule(800),
      })
    ).rejects.toMatchObject({
      code: "FACILITY_FEE_FROZEN_COLLECT_INVARIANT",
      statusCode: 409,
    } satisfies Partial<AppError>);
    expect(tx.$queryRaw).toHaveBeenCalled();
  });

  it("hard-fails a damaged v1 schedule instead of charging zero", async () => {
    const { tx } = createTx();
    await expect(
      settleCloseFundingFacilityFees(tx as never, {
        ...closeInput,
        currentInvoiceId: "inv-v1",
        offerDetails: {
          fee_schedule_version: 1,
          facility_fee_collect_amount: -50,
          additional_fees: [{ name: "Legal", kind: "amount", value: 500 }],
        },
      })
    ).rejects.toMatchObject({
      code: "FEE_SCHEDULE_INVALID",
      statusCode: 409,
    } satisfies Partial<AppError>);
  });
});
