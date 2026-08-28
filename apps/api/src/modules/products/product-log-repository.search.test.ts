jest.mock("../../lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    productLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from "../../lib/prisma";
import { productLogRepository } from "./repository";

const mockPrisma = prisma as unknown as {
  $queryRaw: jest.Mock;
  productLog: { findMany: jest.Mock; count: jest.Mock };
};

describe("ProductLogRepository search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.productLog.findMany.mockResolvedValue([]);
    mockPrisma.productLog.count.mockResolvedValue(0);
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "log_invoice_1" }]);
  });

  it("matches product name case-insensitively and keeps actor/email/ID search for list and export", async () => {
    for (const query of ["Invoice Financing", "invoice", "FINANCING"]) {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: "log_invoice_1" }]);
      await productLogRepository.findAll({
        page: 1,
        pageSize: 15,
        search: query,
        dateRange: "all",
      });
    }

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(3);
    const listWhere = mockPrisma.productLog.findMany.mock.calls[0][0].where;
    expect(listWhere.OR).toEqual(
      expect.arrayContaining([
        { user: { email: { contains: "Invoice Financing", mode: "insensitive" } } },
        { user: { first_name: { contains: "Invoice Financing", mode: "insensitive" } } },
        { user: { last_name: { contains: "Invoice Financing", mode: "insensitive" } } },
        { product_id: { contains: "Invoice Financing", mode: "insensitive" } },
        { id: { in: ["log_invoice_1"] } },
      ])
    );

    mockPrisma.$queryRaw.mockResolvedValue([{ id: "log_invoice_1" }]);
    await productLogRepository.findForExport({
      search: "FINANCING",
      dateRange: "all",
    });
    const exportWhere = mockPrisma.productLog.findMany.mock.calls[3][0].where;
    expect(exportWhere.OR).toEqual(
      expect.arrayContaining([
        { user: { email: { contains: "FINANCING", mode: "insensitive" } } },
        { product_id: { contains: "FINANCING", mode: "insensitive" } },
        { id: { in: ["log_invoice_1"] } },
      ])
    );
  });

  it("still finds rows by product ID when no name matches", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await productLogRepository.findAll({
      page: 1,
      pageSize: 15,
      search: "abc123",
      dateRange: "all",
    });
    const where = mockPrisma.productLog.findMany.mock.calls[0][0].where;
    expect(where.OR).toContainEqual({
      product_id: { contains: "abc123", mode: "insensitive" },
    });
    expect(where.OR.some((clause: { id?: unknown }) => "id" in clause)).toBe(false);
  });

  it("does not query name matches when search is empty", async () => {
    await productLogRepository.findAll({
      page: 1,
      pageSize: 15,
      dateRange: "all",
    });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.productLog.findMany.mock.calls[0][0].where.OR).toBeUndefined();
  });
});
