jest.mock("./mapper", () => ({
  ...jest.requireActual<typeof import("./mapper")>("./mapper"),
  mapNoteDetail: jest.fn(async () => ({ id: "note-tenure" })),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    noteEvent: { create: jest.fn().mockResolvedValue({}) },
    noteSettlement: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: "set-1" }),
    },
  },
}));

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

jest.mock("../notification/note-lifecycle-notifications", () => {
  const actual = jest.requireActual<typeof import("../notification/note-lifecycle-notifications")>(
    "../notification/note-lifecycle-notifications"
  );
  return {
    ...actual,
    notifyNotePaymentReceived: jest.fn().mockResolvedValue(undefined),
  };
});

import { NoteFundingStatus, NoteInvestmentStatus, NoteServicingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { noteRepository } from "./repository";
import { NoteService } from "./service";

function tenureNote(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-tenure",
    funding_status: NoteFundingStatus.FUNDED,
    servicing_status: NoteServicingStatus.CURRENT,
    tenure_days: 90,
    disbursement_value_date: new Date("2026-01-01T00:00:00.000Z"),
    activated_at: new Date("2026-01-01T00:00:00.000Z"),
    maturity_date: new Date("2026-04-01T00:00:00.000Z"),
    grace_period_days: 7,
    funded_amount: new Prisma.Decimal("80000"),
    profit_rate_percent: new Prisma.Decimal("10"),
    service_fee_rate_percent: new Prisma.Decimal("15"),
    tawidh_rate_cap_percent: new Prisma.Decimal("1"),
    gharamah_rate_cap_percent: new Prisma.Decimal("9"),
    invoice_snapshot: { details: { value: 100000 } },
    requested_amount: new Prisma.Decimal("100000"),
    payments: [],
    settlements: [],
    investments: [
      {
        id: "inv-1",
        investor_organization_id: "org-1",
        amount: new Prisma.Decimal("80000"),
        status: NoteInvestmentStatus.CONFIRMED,
      },
    ],
    payment_schedules: [{ due_date: new Date("2026-04-01T00:00:00.000Z"), sequence: 1 }],
    ...overrides,
  };
}

describe("NoteService tenure settlement", () => {
  const adminActor = { userId: "admin-1", role: "ADMIN", portal: "ADMIN" };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a future actual settlement date on record-payment", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(tenureNote());
    const service = new NoteService();
    await expect(
      service.recordPayment(
        "note-tenure",
        {
          source: "PAYMASTER" as const,
          receiptAmount: 100_000,
          receiptDate: "2026-08-24T00:00:00.000Z",
          actualSettlementDate: "2099-01-01",
        },
        adminActor
      )
    ).rejects.toThrow(/cannot be in the future/);
  });

  it("rejects a partial admin receipt before grace", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(tenureNote());
    const service = new NoteService();
    await expect(
      service.recordPayment(
        "note-tenure",
        {
          source: "PAYMASTER" as const,
          receiptAmount: 40_000,
          receiptDate: "2026-03-01T00:00:00.000Z",
          actualSettlementDate: "2026-03-01",
        },
        adminActor
      )
    ).rejects.toMatchObject({ code: "PARTIAL_REPAYMENT_NOT_ALLOWED" });
  });

  it("allows a partial admin receipt after grace to accumulate", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(tenureNote());
    const tx = {
      notePayment: {
        create: jest.fn().mockResolvedValue({
          id: "pay-1",
          note_id: "note-tenure",
          receipt_amount: new Prisma.Decimal("40000"),
          source: "PAYMASTER",
          reference: null,
        }),
      },
      noteEvent: { create: jest.fn().mockResolvedValue({}) },
      note: { findUniqueOrThrow: jest.fn().mockResolvedValue(tenureNote()) },
      noteLedgerAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: "acct-repay" }),
      },
      noteLedgerEntry: { upsert: jest.fn().mockResolvedValue({}) },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );
    const service = new NoteService();
    await service.recordPayment(
      "note-tenure",
      {
        source: "PAYMASTER" as const,
        receiptAmount: 40_000,
        receiptDate: "2026-04-09T00:00:00.000Z",
        actualSettlementDate: "2026-04-09",
      },
      adminActor
    );
    expect(tx.notePayment.create).toHaveBeenCalled();
  });

  it("blocks tenure preview when investor principal remains unpaid after grace", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(
      tenureNote({
        payments: [
          {
            id: "pay-1",
            status: "RECEIVED",
            receipt_amount: new Prisma.Decimal("1000"),
            receipt_date: new Date("2026-04-09T00:00:00.000Z"),
          },
        ],
      })
    );
    const service = new NoteService();
    await expect(
      service.previewSettlement(
        "note-tenure",
        { actualSettlementDate: "2026-04-09" },
        adminActor
      )
    ).rejects.toMatchObject({ code: "SETTLEMENT_INVESTOR_SHORTFALL" });
  });

  it("previews a late settlement when receipts cover principal and profit but not late fees", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(
      tenureNote({
        payments: [
          {
            id: "pay-1",
            status: "RECEIVED",
            receipt_amount: new Prisma.Decimal("85000"),
            receipt_date: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      })
    );
    const tx = {
      noteSettlement: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: "set-1" }),
      },
    };
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (t: typeof tx) => unknown) =>
      fn(tx)
    );
    const service = new NoteService();
    const result = await service.previewSettlement(
      "note-tenure",
      {
        actualSettlementDate: "2026-08-01",
        tawidhAmount: 200,
        gharamahAmount: 300,
      },
      adminActor
    );
    expect(result.profitClassification ?? result.classification).toBe("LATE");
    expect(result.investorObligationCovered).toBe(true);
    expect((result.excessLateChargeAmount ?? 0) > 0).toBe(true);
    expect(tx.noteSettlement.create).toHaveBeenCalled();
  });

  it("uses tenure profit days for overdue headroom instead of the 365-day fallback", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue(tenureNote());
    const service = new NoteService();
    const result = await service.checkOverdueLateCharge("note-tenure", {
      actualSettlementDate: "2026-04-09",
    });
    expect(result.overdue).toBe(true);
    expect(result.availableLateFeeHeadroomAmount).toBeGreaterThan(0);
    expect(result.availableLateFeeHeadroomAmount).toBeLessThan(20_000);
  });
});
