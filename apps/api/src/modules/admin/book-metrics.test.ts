const mockNoteAggregate = jest.fn();
const mockNoteFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    note: {
      aggregate: (...args: unknown[]) => mockNoteAggregate(...args),
      findMany: (...args: unknown[]) => mockNoteFindMany(...args),
    },
  },
}));

import { NoteSettlementStatus, NoteStatus } from "@prisma/client";
import { addMytCalendarDays, mytCalendarParts, mytStartOfDayUtc } from "@cashsouk/types";
import { AdminRepository } from "./repository";

function aggregateRow(amount: number, count: number) {
  return {
    _sum: { funded_amount: { toNumber: () => amount } },
    _count: count,
  };
}

function positionRow(amount: number, maturityDate: Date) {
  return {
    funded_amount: amount,
    profit_rate_percent: 0,
    tenure_days: null,
    disbursement_value_date: null,
    activated_at: null,
    maturity_date: maturityDate,
    payment_schedules: [],
    settlements: [],
  };
}

describe("AdminRepository.getBookMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const today = mytCalendarParts(new Date());
    const dueSoon = mytStartOfDayUtc(addMytCalendarDays(today, 3));
    const later = mytStartOfDayUtc(addMytCalendarDays(today, 30));
    mockNoteFindMany
      .mockResolvedValueOnce([
        positionRow(40_000, dueSoon),
        positionRow(400_000, later),
        positionRow(400_000, later),
        positionRow(410_000, later),
      ])
      .mockResolvedValueOnce([positionRow(15_000, later)])
      .mockResolvedValueOnce([positionRow(10_000, later)])
      .mockResolvedValueOnce([positionRow(5_000, later)]);
    mockNoteAggregate.mockResolvedValue(aggregateRow(80_000, 2));
  });

  it("returns outstanding, in-funding, distressed, and due-soon amounts", async () => {
    const metrics = await new AdminRepository().getBookMetrics();

    expect(metrics).toEqual({
      outstanding: { amount: 1_250_000, count: 4 },
      inFunding: { amount: 80_000, count: 2 },
      distressed: { amount: 15_000, count: 1 },
      arrears: { amount: 10_000, count: 1 },
      defaulted: { amount: 5_000, count: 1 },
      dueSoon: { amount: 40_000, count: 1 },
    });

    expect(mockNoteFindMany).toHaveBeenNthCalledWith(1, {
      where: { status: NoteStatus.ACTIVE },
      select: expect.any(Object),
    });
    expect(mockNoteAggregate).toHaveBeenCalledWith({
      where: { status: { in: [NoteStatus.PUBLISHED, NoteStatus.FUNDING] } },
      _sum: { funded_amount: true },
      _count: true,
    });
    expect(mockNoteFindMany).toHaveBeenNthCalledWith(2, {
      where: { status: { in: [NoteStatus.ARREARS, NoteStatus.DEFAULTED] } },
      select: expect.any(Object),
    });

    const select = mockNoteFindMany.mock.calls[0]?.[0].select;
    expect(select.settlements.where).toEqual({ status: NoteSettlementStatus.POSTED });
    expect(select.payment_schedules.orderBy).toEqual({ sequence: "asc" });
  });

  it("treats a missing funded sum as zero", async () => {
    mockNoteFindMany.mockReset();
    mockNoteFindMany.mockResolvedValue([]);
    mockNoteAggregate.mockResolvedValue({ _sum: { funded_amount: null }, _count: 0 });

    const metrics = await new AdminRepository().getBookMetrics();
    expect(metrics.outstanding).toEqual({ amount: 0, count: 0 });
    expect(metrics.inFunding).toEqual({ amount: 0, count: 0 });
    expect(metrics.distressed).toEqual({ amount: 0, count: 0 });
    expect(metrics.dueSoon).toEqual({ amount: 0, count: 0 });
  });

  it("reconstructs in-funding as of the Malaysia midnight cutoff", async () => {
    mockNoteFindMany.mockReset();
    mockNoteFindMany.mockResolvedValue([]);
    mockNoteAggregate.mockResolvedValue({ _sum: { funded_amount: null }, _count: 0 });
    const cutoff = new Date("2026-01-01T16:00:00.000Z");

    await new AdminRepository().getBookMetrics(cutoff);

    expect(mockNoteAggregate).toHaveBeenCalledWith({
      where: {
        published_at: { not: null, lt: cutoff },
        OR: [
          { activated_at: { gte: cutoff } },
          {
            activated_at: null,
            status: { in: [NoteStatus.PUBLISHED, NoteStatus.FUNDING] },
          },
        ],
      },
      _sum: { funded_amount: true },
      _count: true,
    });

    const select = mockNoteFindMany.mock.calls[0]?.[0].select;
    expect(select.settlements.where).toEqual({
      status: NoteSettlementStatus.POSTED,
      posted_at: { lt: cutoff },
    });
  });
});
