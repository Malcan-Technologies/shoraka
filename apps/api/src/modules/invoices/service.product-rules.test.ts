const mockApplyChanges = jest.fn(
  async (
    _ids: string[],
    _db: unknown,
    mutate: (tx: { invoice: { update: jest.Mock; delete: jest.Mock } }) => Promise<unknown>
  ) => ({
    result: await mutate({
      invoice: {
        update: jest.fn().mockResolvedValue({ id: "inv-1", status: "DRAFT" }),
        delete: jest.fn(),
      },
    }),
    snapshots: [],
  })
);
const mockFindApplicationById = jest.fn();

jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: jest.fn(),
  applyContractCapacityChanges: (...args: unknown[]) =>
    mockApplyChanges(...(args as [string[], unknown, never])),
}));

jest.mock("./repository", () => ({
  InvoiceRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByApplicationId: jest.fn().mockResolvedValue([]),
  })),
}));
jest.mock("../applications/repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: mockFindApplicationById,
  })),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../contracts/repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({
    findById: jest.fn().mockResolvedValue({ id: "contract-1", status: "APPROVED" }),
  })),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    invoice: { update: jest.fn(), delete: jest.fn() },
    application: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { InvoiceService } from "./service";
import { InvoiceStatus, PRODUCT_LIMIT_VIOLATION_CODE } from "@cashsouk/types";

const restrictiveWorkflow = [
  {
    id: "invoice_details",
    config: {
      min_invoice_face_value: 20_000,
      min_invoice_value: 15_000,
      max_financing_ratio_percent: 70,
    },
  },
];

describe("InvoiceService product rules", () => {
  const service = new InvoiceService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "contract-1",
      financing_structure: { structure_type: "existing_contract" },
      status: "DRAFT",
    });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(restrictiveWorkflow);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();
  });

  it("rejects createInvoice when face value is below the frozen minimum", async () => {
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      jest.fn().mockResolvedValue({
        id: "app-1",
        contract_id: "contract-1",
        financing_structure: { structure_type: "existing_contract" },
      });

    await expect(
      service.createInvoice(
        "app-1",
        "contract-1",
        { value: 10_000, applied_financing: 6_000, financing_ratio_percent: 60 },
        "user-1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Invoice value must be at least RM 20,000.00.",
    });
  });

  it("rejects createInvoice when requested financing is below the frozen minimum", async () => {
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      jest.fn().mockResolvedValue({
        id: "app-1",
        contract_id: "contract-1",
        financing_structure: { structure_type: "existing_contract" },
      });

    await expect(
      service.createInvoice(
        "app-1",
        "contract-1",
        { value: 25_000, applied_financing: 10_000, financing_ratio_percent: 40 },
        "user-1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Financing amount must be at least RM 15,000.00.",
    });
  });

  it("rejects updateInvoice when the ratio exceeds the frozen max", async () => {
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.DRAFT,
      contract_id: "contract-1",
      application_id: "app-1",
      details: { value: 25_000, applied_financing: 15_000, financing_ratio_percent: 60 },
      application: { issuer_organization: { owner_user_id: "user-1" } },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);

    await expect(
      service.updateInvoice(
        "inv-1",
        { details: { applied_financing: 20_000, financing_ratio_percent: 80 } },
        "user-1"
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      code: PRODUCT_LIMIT_VIOLATION_CODE,
      message: "Financing ratio cannot exceed 70%.",
    });
    expect(mockApplyChanges).not.toHaveBeenCalled();
  });
});
