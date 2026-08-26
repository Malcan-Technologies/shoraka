const mockNoteAggregate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    note: {
      aggregate: (...args: unknown[]) => mockNoteAggregate(...args),
    },
  },
}));

import { NoteStatus } from "@prisma/client";
import { AdminRepository } from "./repository";

function aggregateRow(amount: number, count: number) {
  return {
    _sum: { funded_amount: { toNumber: () => amount } },
    _count: count,
  };
}

describe("AdminRepository.getBookMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNoteAggregate
      .mockResolvedValueOnce(aggregateRow(1_250_000, 4))
      .mockResolvedValueOnce(aggregateRow(80_000, 2))
      .mockResolvedValueOnce(aggregateRow(15_000, 1))
      .mockResolvedValueOnce(aggregateRow(40_000, 1));
  });

  it("returns outstanding, in-funding, distressed, and due-soon amounts", async () => {
    const metrics = await new AdminRepository().getBookMetrics();

    expect(metrics).toEqual({
      outstanding: { amount: 1_250_000, count: 4 },
      inFunding: { amount: 80_000, count: 2 },
      distressed: { amount: 15_000, count: 1 },
      dueSoon: { amount: 40_000, count: 1 },
    });

    expect(mockNoteAggregate).toHaveBeenNthCalledWith(1, {
      where: { status: NoteStatus.ACTIVE },
      _sum: { funded_amount: true },
      _count: true,
    });
    expect(mockNoteAggregate).toHaveBeenNthCalledWith(2, {
      where: { status: { in: [NoteStatus.PUBLISHED, NoteStatus.FUNDING] } },
      _sum: { funded_amount: true },
      _count: true,
    });
    expect(mockNoteAggregate).toHaveBeenNthCalledWith(3, {
      where: { status: { in: [NoteStatus.ARREARS, NoteStatus.DEFAULTED] } },
      _sum: { funded_amount: true },
      _count: true,
    });

    const dueSoonCall = mockNoteAggregate.mock.calls[3]?.[0] as {
      where: { status: NoteStatus; maturity_date: { gte: Date; lt: Date } };
    };
    expect(dueSoonCall.where.status).toBe(NoteStatus.ACTIVE);
    const start = dueSoonCall.where.maturity_date.gte;
    const end = dueSoonCall.where.maturity_date.lt;
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    expect(Math.round((endDay - startDay) / 86_400_000)).toBe(7);
  });

  it("treats a missing funded sum as zero", async () => {
    mockNoteAggregate.mockReset();
    mockNoteAggregate.mockResolvedValue({ _sum: { funded_amount: null }, _count: 0 });

    const metrics = await new AdminRepository().getBookMetrics();
    expect(metrics.outstanding).toEqual({ amount: 0, count: 0 });
    expect(metrics.inFunding).toEqual({ amount: 0, count: 0 });
    expect(metrics.distressed).toEqual({ amount: 0, count: 0 });
    expect(metrics.dueSoon).toEqual({ amount: 0, count: 0 });
  });
});
