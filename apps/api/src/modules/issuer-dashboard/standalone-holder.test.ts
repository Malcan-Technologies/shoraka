const mockIssuerFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
const mockApplicationFindMany = jest.fn();
const mockNoteFindMany = jest.fn();
const mockWithdrawalFindMany = jest.fn();
const mockScheduleFindMany = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockContractFindFirst = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    application: {
      findMany: (...args: unknown[]) => mockApplicationFindMany(...args),
    },
    note: {
      findMany: (...args: unknown[]) => mockNoteFindMany(...args),
    },
    withdrawalInstruction: {
      findMany: (...args: unknown[]) => mockWithdrawalFindMany(...args),
    },
    notePaymentSchedule: {
      findMany: (...args: unknown[]) => mockScheduleFindMany(...args),
    },
    notePayment: {
      findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
    },
    contract: {
      findFirst: (...args: unknown[]) => mockContractFindFirst(...args),
    },
  },
}));

import { AppError } from "../../lib/http/error-handler";
import { issuerDashboardService } from "./service";

const holderContract = {
  id: "holder-1",
  display_reference: "CTR-H",
  status: "SUBMITTED",
  contract_details: { title: "Holder" },
  customer_details: { name: "Acme" },
};

const facilityContract = {
  id: "facility-1",
  display_reference: "CTR-F",
  status: "APPROVED",
  contract_details: { title: "Facility", approved_facility: 100000 },
  customer_details: { name: "Acme" },
};

function dashboardApplication(overrides: Record<string, unknown>) {
  return {
    id: "app-1",
    created_at: new Date("2026-01-02T00:00:00.000Z"),
    status: "SUBMITTED",
    financing_type: { product_id: "invoice-financing", product_name: "Invoice financing" },
    financing_structure: { structure_type: "invoice_only" },
    invoices: [
      {
        id: "inv-1",
        contract_id: null,
        status: "DRAFT",
        details: { value: 1000 },
        offer_details: null,
        created_at: new Date("2026-01-02T00:00:00.000Z"),
        display_reference: "INV-1",
      },
    ],
    contract: holderContract,
    ...overrides,
  };
}

describe("issuer dashboard standalone holder exclusion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssuerFindUnique.mockResolvedValue({ id: "org-1", owner_user_id: "user-1" });
    mockUserFindUnique.mockResolvedValue({ first_name: "Ada", last_name: "Issuer" });
    mockNoteFindMany.mockResolvedValue([]);
    mockWithdrawalFindMany.mockResolvedValue([]);
    mockScheduleFindMany.mockResolvedValue([]);
    mockPaymentFindMany.mockResolvedValue([]);
    mockApplicationFindMany.mockResolvedValue([]);
  });

  it("omits holder contract buckets and keeps standalone invoice rows", async () => {
    mockApplicationFindMany.mockResolvedValue([
      dashboardApplication({
        id: "app-holder",
        financing_structure: { structure_type: "invoice_only" },
        contract: holderContract,
        invoices: [
          {
            id: "inv-standalone",
            contract_id: null,
            status: "DRAFT",
            details: { value: 2500, number: "INV-S" },
            offer_details: null,
            created_at: new Date("2026-01-02T00:00:00.000Z"),
            display_reference: "INV-S",
          },
        ],
      }),
      dashboardApplication({
        id: "app-facility",
        created_at: new Date("2026-01-03T00:00:00.000Z"),
        financing_type: { product_id: "facility", product_name: "Facility financing" },
        financing_structure: { structure_type: "new_contract" },
        contract: facilityContract,
        invoices: [],
      }),
    ]);

    const dashboard = await issuerDashboardService.getDashboard("org-1", "user-1");
    expect(dashboard.contracts.map((row) => row.id)).toEqual(["facility-1"]);
    expect(dashboard.invoices.map((row) => row.id)).toEqual(["inv-standalone"]);
  });

  it("keeps a mixed-structure contract as a real facility", async () => {
    mockApplicationFindMany.mockResolvedValue([
      dashboardApplication({
        id: "app-invoice",
        financing_structure: { structure_type: "invoice_only" },
        contract: facilityContract,
      }),
      dashboardApplication({
        id: "app-facility",
        created_at: new Date("2026-01-04T00:00:00.000Z"),
        financing_structure: { structure_type: "existing_contract" },
        contract: facilityContract,
        invoices: [],
      }),
    ]);

    const dashboard = await issuerDashboardService.getDashboard("org-1", "user-1");
    expect(dashboard.contracts.map((row) => row.id)).toEqual(["facility-1"]);
  });

  it("returns 404 for a holder contract detail", async () => {
    mockContractFindFirst.mockResolvedValue({
      id: "holder-1",
      applications: [{ financing_structure: { structure_type: "invoice_only" } }],
    });

    await expect(
      issuerDashboardService.getContractDetail("org-1", "user-1", "holder-1")
    ).rejects.toMatchObject({
      statusCode: 404,
      code: "CONTRACT_NOT_FOUND",
    });
    expect(mockApplicationFindMany).not.toHaveBeenCalled();
  });

  it("returns 404 when the contract does not exist", async () => {
    mockContractFindFirst.mockResolvedValue(null);

    await expect(
      issuerDashboardService.getContractDetail("org-1", "user-1", "missing")
    ).rejects.toBeInstanceOf(AppError);
  });
});
