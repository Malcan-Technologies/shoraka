const mockApplyChanges = jest.fn(
  async (
    _ids: string[],
    _db: unknown,
    mutate: (tx: { invoice: { update: jest.Mock; delete: jest.Mock } }) => Promise<unknown>
  ) => ({
    result: await mutate({
      invoice: {
        update: jest.fn().mockResolvedValue({ id: "inv-1", status: "AMENDMENT_REQUESTED" }),
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
import { InvoiceStatus } from "@cashsouk/types";

describe("InvoiceService capacity", () => {
  const service = new InvoiceService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "contract-1",
      status: "AMENDMENT_REQUESTED",
    });
  });

  it("does not reserve draft create/save", async () => {
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.DRAFT,
      contract_id: "contract-1",
      application_id: "app-1",
      details: { value: 10_000, applied_financing: 6_000 },
      application: { issuer_organization: { owner_user_id: "user-1" } },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();

    const { prisma } = await import("../../lib/prisma");
    (prisma.invoice.update as jest.Mock).mockResolvedValue({
      ...invoice,
      details: { value: 12_000 },
    });

    await service.updateInvoice("inv-1", { details: { value: 12_000 } }, "user-1");
    expect(mockApplyChanges).not.toHaveBeenCalled();
  });

  it("hard-revalidates reserved amendment invoices atomically", async () => {
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.AMENDMENT_REQUESTED,
      contract_id: "contract-1",
      application_id: "app-1",
      details: { value: 10_000, applied_financing: 6_000 },
      application: { issuer_organization: { owner_user_id: "user-1" } },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();

    await service.updateInvoice("inv-1", { details: { applied_financing: 9_000 } }, "user-1");

    expect(mockApplyChanges).toHaveBeenCalledWith(
      ["contract-1"],
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });

  it("rejects adding a facility link to an invoice-only invoice", async () => {
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "holder-1",
      financing_structure: { structure_type: "invoice_only" },
      status: "AMENDMENT_REQUESTED",
    });
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.AMENDMENT_REQUESTED,
      contract_id: null,
      application_id: "app-1",
      details: { value: 10_000, applied_financing: 6_000 },
      application: { issuer_organization: { owner_user_id: "user-1" } },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);

    await expect(
      service.updateInvoice("inv-1", { contractId: "holder-1" }, "user-1")
    ).rejects.toMatchObject({
      code: "STANDALONE_INVOICE_NO_FACILITY",
      statusCode: 400,
    });
    expect(mockApplyChanges).not.toHaveBeenCalled();
  });

  it("rejects retargeting an existing-facility invoice during update", async () => {
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "contract-1",
      financing_structure: { structure_type: "existing_contract" },
      status: "AMENDMENT_REQUESTED",
    });
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.AMENDMENT_REQUESTED,
      contract_id: "contract-1",
      application_id: "app-1",
      details: { value: 10_000, applied_financing: 6_000 },
      application: { issuer_organization: { owner_user_id: "user-1" } },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);

    await expect(
      service.updateInvoice("inv-1", { contractId: "contract-2" }, "user-1")
    ).rejects.toMatchObject({
      code: "FACILITY_CONTRACT_MISMATCH",
      statusCode: 400,
    });
    expect(mockApplyChanges).not.toHaveBeenCalled();
  });

  it("does not reserve holder capacity when unlinking an invoice-only invoice", async () => {
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "holder-1",
      financing_structure: { structure_type: "invoice_only" },
      status: "AMENDMENT_REQUESTED",
    });
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.AMENDMENT_REQUESTED,
      contract_id: "holder-1",
      application_id: "app-1",
      details: { value: 10_000, applied_financing: 6_000 },
      application: { issuer_organization: { owner_user_id: "user-1" } },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();
    const repository = (service as unknown as { repository: { update: jest.Mock } }).repository;
    repository.update.mockResolvedValue({ ...invoice, contract_id: null });

    await service.updateInvoice("inv-1", { contractId: null }, "user-1");

    expect(mockApplyChanges).not.toHaveBeenCalled();
    expect(repository.update).toHaveBeenCalledWith(
      "inv-1",
      expect.objectContaining({ contract_id: null })
    );
  });

  it("withdraws a reserved invoice through applyContractCapacityChanges", async () => {
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.SUBMITTED,
      contract_id: "contract-1",
      application_id: "app-1",
      details: { number: "INV-1", value: 10_000 },
      application: { issuer_organization: { owner_user_id: "user-1" }, contract_id: "contract-1" },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);

    await service.withdrawInvoice("inv-1", "user-1");

    expect(mockApplyChanges).toHaveBeenCalledWith(
      ["contract-1"],
      expect.anything(),
      expect.any(Function)
    );
  });

  it("withdraws a standalone invoice without refreshing holder capacity", async () => {
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "holder-1",
      financing_structure: { structure_type: "invoice_only" },
      status: "SUBMITTED",
    });
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.SUBMITTED,
      contract_id: "legacy-holder-1",
      application_id: "app-1",
      details: { number: "INV-1", value: 10_000 },
      application: {
        contract_id: "holder-1",
        financing_structure: { structure_type: "invoice_only" },
        issuer_organization: { owner_user_id: "user-1" },
      },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);
    (
      service as unknown as { repository: { findByApplicationId: jest.Mock } }
    ).repository.findByApplicationId.mockResolvedValue([
      { ...invoice, status: InvoiceStatus.WITHDRAWN },
    ]);
    const { prisma } = await import("../../lib/prisma");
    (prisma.invoice.update as jest.Mock).mockResolvedValue({
      ...invoice,
      status: InvoiceStatus.WITHDRAWN,
    });

    await service.withdrawInvoice("inv-1", "user-1");

    expect(mockApplyChanges).not.toHaveBeenCalled();
    expect(prisma.invoice.update).toHaveBeenCalled();
  });

  it("deletes a standalone invoice without refreshing holder capacity", async () => {
    mockFindApplicationById.mockResolvedValue({
      id: "app-1",
      contract_id: "holder-1",
      financing_structure: { structure_type: "invoice_only" },
    });
    const invoice = {
      id: "inv-1",
      status: InvoiceStatus.SUBMITTED,
      contract_id: "legacy-holder-1",
      application_id: "app-1",
      details: {},
      application: {
        contract_id: "holder-1",
        financing_structure: { structure_type: "invoice_only" },
        issuer_organization: { owner_user_id: "user-1" },
      },
    };
    (service as unknown as { verifyInvoiceAccess: jest.Mock }).verifyInvoiceAccess = jest
      .fn()
      .mockResolvedValue(invoice);
    const repository = (service as unknown as { repository: { delete: jest.Mock } }).repository;

    await service.deleteInvoice("inv-1", "user-1");

    expect(mockApplyChanges).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith("inv-1");
  });
});
