import { InvestorBalanceTransactionSource } from "@prisma/client";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    investorOrganization: {
      findMany: jest.fn(),
    },
    noteInvestment: {
      findMany: jest.fn(),
    },
    investorBalanceTransaction: {
      findMany: jest.fn(),
    },
    investorBalance: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";

const mockedPrisma = prisma as unknown as {
  investorOrganization: {
    findMany: jest.Mock;
  };
  noteInvestment: {
    findMany: jest.Mock;
  };
  investorBalanceTransaction: {
    findMany: jest.Mock;
  };
  investorBalance: {
    findMany: jest.Mock;
  };
};

describe("NoteService.getInvestorPortfolioHistory", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("collapses YTD history into month-end carry-forward points", async () => {
    jest.setSystemTime(new Date(2026, 4, 31, 12));
    mockedPrisma.investorOrganization.findMany.mockResolvedValue([{ id: "org_1" }]);
    mockedPrisma.investorBalanceTransaction.findMany.mockResolvedValue([
      {
        posted_at: new Date(2026, 0, 2, 9),
        direction: "IN",
        amount: 1000,
        source: InvestorBalanceTransactionSource.MANUAL_TOPUP,
        metadata: null,
      },
      {
        posted_at: new Date(2026, 4, 26, 9),
        direction: "IN",
        amount: 250,
        source: InvestorBalanceTransactionSource.MANUAL_TOPUP,
        metadata: null,
      },
    ]);
    mockedPrisma.investorBalance.findMany.mockResolvedValue([{ available_amount: 1250 }]);
    mockedPrisma.noteInvestment.findMany.mockResolvedValue([]);

    const service = new NoteService();
    const result = await service.getInvestorPortfolioHistory("user_1", { range: "YTD" });

    expect(result.granularity).toBe("month");
    expect(result.points.map((point) => point.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
    expect(result.points.map((point) => point.portfolioTotal)).toEqual([1000, 1000, 1000, 1000, 1250]);
  });

  it("extends short ranges through today with carry-forward values", async () => {
    jest.setSystemTime(new Date(2026, 0, 12, 12));
    mockedPrisma.investorOrganization.findMany.mockResolvedValue([{ id: "org_1" }]);
    mockedPrisma.investorBalanceTransaction.findMany.mockResolvedValue([
      {
        posted_at: new Date(2026, 0, 2, 9),
        direction: "IN",
        amount: 100,
        source: InvestorBalanceTransactionSource.MANUAL_TOPUP,
        metadata: null,
      },
      {
        posted_at: new Date(2026, 0, 8, 9),
        direction: "IN",
        amount: 30,
        source: InvestorBalanceTransactionSource.MANUAL_TOPUP,
        metadata: null,
      },
    ]);
    mockedPrisma.investorBalance.findMany.mockResolvedValue([{ available_amount: 130 }]);
    mockedPrisma.noteInvestment.findMany.mockResolvedValue([]);

    const service = new NoteService();
    const result = await service.getInvestorPortfolioHistory("user_1", { range: "1W" });

    expect(result.granularity).toBe("day");
    expect(result.points).toHaveLength(7);
    expect(result.points[0]?.date).toBe("2026-01-06");
    expect(result.points.at(-1)?.date).toBe("2026-01-12");
    expect(result.points.map((point) => point.portfolioTotal)).toEqual([100, 100, 130, 130, 130, 130, 130]);
  });
});
