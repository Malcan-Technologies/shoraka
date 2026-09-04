const mockContractCount = jest.fn();
const mockContractFindMany = jest.fn();
const mockContractFindUnique = jest.fn();
const mockUserFindMany = jest.fn();
const mockNoteFindMany = jest.fn();
const mockApplicationLogFindMany = jest.fn();
const mockInvoiceFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    contract: {
      count: (...args: unknown[]) => mockContractCount(...args),
      findMany: (...args: unknown[]) => mockContractFindMany(...args),
      findUnique: (...args: unknown[]) => mockContractFindUnique(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
    note: {
      findMany: (...args: unknown[]) => mockNoteFindMany(...args),
    },
    applicationLog: {
      findMany: (...args: unknown[]) => mockApplicationLogFindMany(...args),
    },
    invoice: {
      findMany: (...args: unknown[]) => mockInvoiceFindMany(...args),
    },
  },
}));

jest.mock("../../lib/refresh-contract-facility", () => {
  const actual = jest.requireActual("../../lib/refresh-contract-facility") as Record<string, unknown>;
  return {
    ...actual,
    overlayReadCapacityOnContracts: jest.fn(async (_db: unknown, contracts: unknown) => contracts),
  };
});

import { Prisma } from "@prisma/client";
import { realFacilityContractWhere } from "../../lib/standalone-holder-contract";
import { AdminRepository } from "./repository";

function hasRealFacilityFilter(where: Prisma.ContractWhereInput | undefined): boolean {
  const expected = realFacilityContractWhere();
  if (!where) return false;
  if (JSON.stringify(where) === JSON.stringify(expected)) return true;
  if (JSON.stringify(where.AND) === JSON.stringify([expected])) return true;
  return Array.isArray(where.AND) && where.AND.some((clause) => JSON.stringify(clause) === JSON.stringify(expected));
}

describe("AdminRepository real-facility contract reads", () => {
  const repo = new AdminRepository();

  beforeEach(() => {
    jest.clearAllMocks();
    mockContractFindMany.mockResolvedValue([]);
    mockContractCount.mockResolvedValue(0);
    mockUserFindMany.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
    mockApplicationLogFindMany.mockResolvedValue([]);
    mockInvoiceFindMany.mockResolvedValue([]);
  });

  it("combines the real-facility filter with details, status, and search OR", async () => {
    await repo.getContracts({
      page: 1,
      pageSize: 10,
      search: "acme",
      status: "APPROVED",
    });

    const where = mockContractFindMany.mock.calls[0]?.[0]?.where as Prisma.ContractWhereInput;
    expect(hasRealFacilityFilter(where)).toBe(true);
    expect(where.contract_details).toEqual({ not: Prisma.DbNull });
    expect(where.status).toBe("APPROVED");
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { id: { contains: "acme", mode: "insensitive" } },
        { display_reference: { contains: "acme", mode: "insensitive" } },
        { issuer_organization: { name: { contains: "acme", mode: "insensitive" } } },
      ])
    );
    expect(mockContractCount).toHaveBeenCalledWith({ where });
  });

  it("applies the real-facility filter to every dashboard metric count", async () => {
    mockContractCount.mockResolvedValue(2);

    const metrics = await repo.getContractDashboardMetrics();
    expect(metrics).toEqual({
      total: 2,
      actionRequired: 2,
      draft: 2,
      offerSent: 2,
      approved: 2,
      rejectedOrWithdrawn: 2,
    });
    expect(mockContractCount).toHaveBeenCalledTimes(6);
    for (const call of mockContractCount.mock.calls) {
      expect(hasRealFacilityFilter(call[0]?.where as Prisma.ContractWhereInput)).toBe(true);
    }
  });

  it("returns isStandaloneHolder from linked application structures", async () => {
    mockContractFindUnique.mockResolvedValue({
      id: "holder-1",
      display_reference: "CTR-H",
      issuer_organization_id: "org-1",
      originating_application_id: "app-1",
      status: "SUBMITTED",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
      contract_details: null,
      offer_details: null,
      customer_details: { name: "Acme" },
      issuer_organization: { name: "Issuer", display_reference: "ISS-1" },
      applications: [
        {
          id: "app-1",
          display_reference: "APP-1",
          status: "SUBMITTED",
          submitted_at: new Date("2026-01-01T00:00:00.000Z"),
          updated_at: new Date("2026-01-02T00:00:00.000Z"),
          financing_type: { product_id: "invoice-financing" },
          financing_structure: { structure_type: "invoice_only" },
          invoices: [],
        },
      ],
    });

    const holder = await repo.getContractById("holder-1");
    expect(holder?.isStandaloneHolder).toBe(true);

    mockContractFindUnique.mockResolvedValue({
      id: "facility-1",
      display_reference: "CTR-F",
      issuer_organization_id: "org-1",
      originating_application_id: "app-2",
      status: "APPROVED",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
      contract_details: { title: "Facility" },
      offer_details: null,
      customer_details: { name: "Acme" },
      issuer_organization: { name: "Issuer", display_reference: "ISS-1" },
      applications: [
        {
          id: "app-2",
          display_reference: "APP-2",
          status: "APPROVED",
          submitted_at: new Date("2026-01-01T00:00:00.000Z"),
          updated_at: new Date("2026-01-02T00:00:00.000Z"),
          financing_type: { product_id: "facility" },
          financing_structure: { structure_type: "new_contract" },
          invoices: [],
        },
        {
          id: "app-3",
          display_reference: "APP-3",
          status: "SUBMITTED",
          submitted_at: new Date("2026-01-03T00:00:00.000Z"),
          updated_at: new Date("2026-01-03T00:00:00.000Z"),
          financing_type: { product_id: "invoice-financing" },
          financing_structure: { structure_type: "invoice_only" },
          invoices: [],
        },
      ],
    });

    const facility = await repo.getContractById("facility-1");
    expect(facility?.isStandaloneHolder).toBe(false);
  });

  it("treats contracts with no applications as real facilities", async () => {
    mockContractFindUnique.mockResolvedValue({
      id: "empty-1",
      display_reference: "CTR-E",
      issuer_organization_id: "org-1",
      originating_application_id: null,
      status: "DRAFT",
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-02T00:00:00.000Z"),
      contract_details: null,
      offer_details: null,
      customer_details: null,
      issuer_organization: null,
      applications: [],
    });

    const empty = await repo.getContractById("empty-1");
    expect(empty?.isStandaloneHolder).toBe(false);
  });
});
