jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

import { NoteFundingStatus, NoteServicingStatus, Prisma } from "@prisma/client";
import { noteRepository } from "./repository";
import { NoteService } from "./service";

describe("NoteService checkOverdueLateCharge headroom", () => {
  const activatedAt = new Date("2026-01-01T00:00:00.000Z");
  const dueDate = new Date("2026-04-01T00:00:00.000Z");
  const maturityDate = new Date("2027-01-01T00:00:00.000Z");

  const baseNote = {
    id: "note-headroom",
    funding_status: NoteFundingStatus.FUNDED,
    servicing_status: NoteServicingStatus.LATE,
    activated_at: activatedAt,
    funded_amount: new Prisma.Decimal("100000"),
    profit_rate_percent: new Prisma.Decimal("10"),
    service_fee_rate_percent: new Prisma.Decimal("15"),
    grace_period_days: 0,
    tawidh_rate_cap_percent: new Prisma.Decimal("1"),
    gharamah_rate_cap_percent: new Prisma.Decimal("9"),
    maturity_date: maturityDate,
    payment_schedules: [{ due_date: dueDate, sequence: 1 }],
    invoice_snapshot: {
      details: { value: 110000 },
    },
    requested_amount: new Prisma.Decimal("110000"),
    settlements: [] as Array<unknown>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns zero headroom and zero suggestions when profit consumes the invoice spread", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({ ...baseNote });

    const service = new NoteService();
    const result = await service.checkOverdueLateCharge("note-headroom", {
      receiptDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
    });

    expect(result.overdue).toBe(true);
    expect(result.availableLateFeeHeadroomAmount).toBe(0);
    expect(result.suggestedTawidhAmount).toBe(0);
    expect(result.suggestedGharamahAmount).toBe(0);
    expect(result.message).toContain("no headroom");
  });

  it("returns headroom for partially funded notes and never suggests fees above it", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...baseNote,
      funded_amount: new Prisma.Decimal("60000"),
      invoice_snapshot: {
        details: { value: 100000 },
      },
      requested_amount: new Prisma.Decimal("100000"),
    });

    const service = new NoteService();
    const result = await service.checkOverdueLateCharge("note-headroom", {
      receiptDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
    });

    expect(result.overdue).toBe(true);
    expect(result.availableLateFeeHeadroomAmount).toBeCloseTo(34000, 2);
    expect(result.suggestedTawidhAmount + result.suggestedGharamahAmount).toBeLessThanOrEqual(
      result.availableLateFeeHeadroomAmount! + 0.01
    );
    expect(result.suggestedTawidhAmount + result.suggestedGharamahAmount).toBeLessThanOrEqual(
      result.remainingTawidhAmount + result.remainingGharamahAmount + 0.01
    );
  });

  it("uses invoice settlement amount for headroom even when a partial receipt is supplied", async () => {
    (noteRepository.findById as jest.Mock).mockResolvedValue({
      ...baseNote,
      funded_amount: new Prisma.Decimal("60000"),
      invoice_snapshot: {
        details: { value: 100000 },
      },
      requested_amount: new Prisma.Decimal("100000"),
    });

    const service = new NoteService();
    const result = await service.checkOverdueLateCharge("note-headroom", {
      receiptAmount: 25000,
      receiptDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
    });

    expect(result.receiptAmount).toBe(25000);
    expect(result.availableLateFeeHeadroomAmount).toBeCloseTo(34000, 2);
  });
});
