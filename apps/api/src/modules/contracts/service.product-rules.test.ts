const mockFindByBaseAndVersion = jest.fn();
const mockFindProductById = jest.fn();
const mockFindApplicationById = jest.fn();
const mockFindContractById = jest.fn();
const mockUpdateContract = jest.fn();

jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindProductById(...args),
    findByBaseAndVersion: (...args: unknown[]) => mockFindByBaseAndVersion(...args),
  })),
}));

jest.mock("./repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindContractById(...args),
    update: (...args: unknown[]) => mockUpdateContract(...args),
  })),
}));

jest.mock("../applications/repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindApplicationById(...args),
  })),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationReviewRemark: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.mock("../../lib/refresh-contract-facility", () => ({
  overlayReadCapacityOnContracts: jest.fn((rows: unknown) => rows),
}));

jest.mock("../paymaster/service", () => ({
  persistDraftCustomerDetails: jest.fn((input: { customerDetails: unknown }) => input.customerDetails),
  shouldRetainLinkedFacilityPaymaster: jest.fn().mockReturnValue(false),
}));

import { ContractService } from "./service";
import { PRODUCT_LIMIT_VIOLATION_CODE } from "@cashsouk/types";

describe("ContractService updateContract product rules", () => {
  const service = new ContractService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindContractById.mockResolvedValue({
      id: "contract-1",
      status: "DRAFT",
      contract_details: { start_date: "2026-01-01", end_date: "2027-01-01" },
      customer_details: null,
      applications: [{ id: "app-1" }],
      issuer_organization: { owner_user_id: "user-1" },
    });
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      financing_type: { product_id: "prod-1" },
      product_version: 3,
      financing_structure: { structure_type: "new_contract" },
    });
    mockFindByBaseAndVersion.mockResolvedValue({
      workflow: [{ id: "contract_details", config: { min_contract_months: 12 } }],
    });
    mockUpdateContract.mockResolvedValue({ id: "contract-1" });
  });

  it("rejects a facility shorter than min_contract_months", async () => {
    await expect(
      service.updateContract(
        "contract-1",
        {
          contract_details: {
            title: "Facility",
            number: "C-1",
            value: 100_000,
            financing: 80_000,
            start_date: "2026-01-01",
            end_date: "2026-06-01",
          },
        },
        "user-1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
    });
    expect(mockFindByBaseAndVersion).toHaveBeenCalledWith("prod-1", 3);
    expect(mockFindProductById).not.toHaveBeenCalled();
    expect(mockUpdateContract).not.toHaveBeenCalled();
  });

  it("accepts a facility that meets min_contract_months", async () => {
    await service.updateContract(
      "contract-1",
      {
        contract_details: {
          title: "Facility",
          number: "C-1",
          value: 100_000,
          financing: 80_000,
          start_date: "2026-01-01",
          end_date: "2028-01-01",
        },
      },
      "user-1"
    );
    expect(mockUpdateContract).toHaveBeenCalled();
  });

  it("skips product-rule checks for invoice_only structure", async () => {
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      financing_type: { product_id: "prod-1" },
      product_version: 3,
      financing_structure: { structure_type: "invoice_only" },
    });

    await expect(
      service.updateContract(
        "contract-1",
        {
          contract_details: {
            title: "Facility",
            number: "C-1",
            value: 100_000,
            financing: 80_000,
            start_date: "2026-01-01",
            end_date: "2026-02-01",
          },
        },
        "user-1"
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Facility financing fields are not allowed for invoice-only structure.",
    });
    expect(mockFindByBaseAndVersion).not.toHaveBeenCalled();
  });
});
