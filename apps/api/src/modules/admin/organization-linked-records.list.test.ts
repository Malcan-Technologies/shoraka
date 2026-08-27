const mockIssuerFindUnique = jest.fn();
const mockInvestorFindUnique = jest.fn();
const mockApplicationCount = jest.fn();
const mockApplicationFindMany = jest.fn();
const mockContractCount = jest.fn();
const mockContractFindMany = jest.fn();
const mockNoteCount = jest.fn();
const mockNoteFindMany = jest.fn();
const mockInvestmentCount = jest.fn();
const mockInvestmentFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    investorOrganization: {
      findUnique: (...args: unknown[]) => mockInvestorFindUnique(...args),
    },
    application: {
      count: (...args: unknown[]) => mockApplicationCount(...args),
      findMany: (...args: unknown[]) => mockApplicationFindMany(...args),
    },
    contract: {
      count: (...args: unknown[]) => mockContractCount(...args),
      findMany: (...args: unknown[]) => mockContractFindMany(...args),
    },
    note: {
      count: (...args: unknown[]) => mockNoteCount(...args),
      findMany: (...args: unknown[]) => mockNoteFindMany(...args),
    },
    noteInvestment: {
      count: (...args: unknown[]) => mockInvestmentCount(...args),
      findMany: (...args: unknown[]) => mockInvestmentFindMany(...args),
    },
  },
}));

import { AppError } from "../../lib/http/error-handler";
import { listOrganizationLinkedRecords } from "./organization-linked-records";

describe("listOrganizationLinkedRecords", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssuerFindUnique.mockResolvedValue({ id: "iss-1" });
    mockInvestorFindUnique.mockResolvedValue({ id: "inv-1" });
    mockApplicationCount.mockResolvedValue(1);
    mockContractCount.mockResolvedValue(0);
    mockNoteCount.mockResolvedValue(0);
    mockInvestmentCount.mockResolvedValue(1);
    mockApplicationFindMany.mockResolvedValue([]);
    mockContractFindMany.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
    mockInvestmentFindMany.mockResolvedValue([]);
  });

  it("returns 404-null when the organization is missing", async () => {
    mockIssuerFindUnique.mockResolvedValue(null);
    await expect(
      listOrganizationLinkedRecords("issuer", "missing", { page: 1, pageSize: 20 })
    ).resolves.toBeNull();
  });

  it("lists issuer applications and never queries investments", async () => {
    mockApplicationFindMany.mockResolvedValue([
      {
        id: "app-1",
        display_reference: "APP-1",
        status: "SUBMITTED",
        financing_type: { product_id: "invoice-financing" },
        contract_id: null,
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
        invoices: [{ details: { value: 1000, financing_ratio_percent: 80 } }],
        contract: null,
      },
    ]);

    const result = await listOrganizationLinkedRecords("issuer", "iss-1", {
      type: "applications",
      page: 1,
      pageSize: 20,
    });

    expect(result?.counts).toEqual({ applications: 1, contracts: 0, notes: 0 });
    expect(result?.items).toHaveLength(1);
    expect(result?.items[0]).toMatchObject({
      type: "application",
      id: "app-1",
      displayReference: "APP-1",
      title: "Application",
      amount: 800,
      productId: "invoice-financing",
    });
    expect(mockInvestmentFindMany).not.toHaveBeenCalled();
    expect(mockInvestmentCount).not.toHaveBeenCalled();
  });

  it("uses the product name as the application title when present", async () => {
    mockApplicationFindMany.mockResolvedValue([
      {
        id: "app-2",
        display_reference: "APP-2",
        status: "SUBMITTED",
        financing_type: { product_id: "prod_cuid", product_name: "Accounts Receivable Financing-i" },
        contract_id: null,
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
        invoices: [],
        contract: null,
      },
    ]);

    const result = await listOrganizationLinkedRecords("issuer", "iss-1", {
      type: "applications",
      page: 1,
      pageSize: 20,
    });

    expect(result?.items[0]?.title).toBe("Accounts Receivable Financing-i");
    expect(result?.items[0]?.title).not.toContain("prod_cuid");
  });

  it("rejects issuer investment requests before querying", async () => {
    await expect(
      listOrganizationLinkedRecords("issuer", "iss-1", {
        type: "investments",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(mockInvestmentFindMany).not.toHaveBeenCalled();
  });

  it("lists investor investments and never queries applications", async () => {
    mockInvestmentFindMany.mockResolvedValue([
      {
        id: "ni-1",
        status: "CONFIRMED",
        amount: { toNumber: () => 5000 },
        committed_at: new Date("2026-02-01T00:00:00.000Z"),
        updated_at: new Date("2026-02-02T00:00:00.000Z"),
        note: { id: "note-1", note_reference: "NT-1", title: "Note One" },
      },
    ]);

    const result = await listOrganizationLinkedRecords("investor", "inv-1", {
      page: 1,
      pageSize: 20,
    });

    expect(result?.counts).toEqual({ investments: 1 });
    expect(result?.items[0]).toMatchObject({
      type: "investment",
      noteId: "note-1",
      amount: 5000,
    });
    expect(mockApplicationFindMany).not.toHaveBeenCalled();
    expect(mockContractFindMany).not.toHaveBeenCalled();
    expect(mockNoteFindMany).not.toHaveBeenCalled();
  });

  it("rejects investor application requests", async () => {
    await expect(
      listOrganizationLinkedRecords("investor", "inv-1", {
        type: "applications",
        page: 1,
        pageSize: 20,
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(mockApplicationFindMany).not.toHaveBeenCalled();
  });
});
