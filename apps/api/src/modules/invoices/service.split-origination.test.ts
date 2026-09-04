const mockTx: {
  $queryRaw: jest.Mock;
  application: { findUnique: jest.Mock };
  contract: { findUnique: jest.Mock };
  invoice: { count: jest.Mock; create: jest.Mock; findMany: jest.Mock };
} = {
  $queryRaw: jest.fn(),
  application: { findUnique: jest.fn() },
  contract: { findUnique: jest.fn() },
  invoice: { count: jest.fn(), create: jest.fn(), findMany: jest.fn() },
};

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(async (cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  },
}));
jest.mock("../../lib/display-reference", () => ({
  allocateDisplayReference: jest.fn(
    async (_input: unknown, persist: (tx: typeof mockTx, reference: string) => Promise<unknown>) =>
      persist(mockTx, "INV-ARF-202608-0N5")
  ),
  resolveApplicationProductCode: jest.fn(async () => "ARF"),
}));

import { InvoiceService } from "./service";
import { AppError } from "../../lib/http/error-handler";

describe("InvoiceService split origination create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.$queryRaw.mockResolvedValue([{ id: "app_1" }]);
    mockTx.invoice.count.mockResolvedValue(0);
    mockTx.invoice.findMany.mockResolvedValue([]);
  });

  it("rejects creating an invoice on a newly created new_contract application", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_1",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "new_contract" },
      issuer_organization_id: "org_1",
      product_version: 1,
    });

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_1" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);

    await expect(
      service.createInvoice("app_1", "con_1", { number: "INV-1", value: 1000 }, "user_1")
    ).rejects.toMatchObject({
      code: "FACILITY_ONLY_NO_INVOICE",
      statusCode: 400,
    } satisfies Partial<AppError>);
    expect(mockTx.invoice.create).not.toHaveBeenCalled();
  });

  it("allows creating an invoice on a grandfathered combined new_contract application", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_legacy",
      financing_type: { product_id: "prod_1", product_code: "ARF" },
      financing_structure: { structure_type: "new_contract" },
      issuer_organization_id: "org_1",
      product_version: 1,
    });
    mockTx.invoice.create.mockResolvedValue({
      id: "inv_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.invoice.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: "inv_1" });
    mockTx.invoice.update = jest.fn().mockResolvedValue({});

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_legacy" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();

    await expect(
      service.createInvoice("app_legacy", "con_1", { number: "INV-1", value: 1000 }, "user_1")
    ).resolves.toBeTruthy();
    expect(mockTx.invoice.create).toHaveBeenCalled();
  });

  it("rejects existing-facility drawdowns without an approved owned facility", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_draw",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "existing_contract" },
      issuer_organization_id: "org_1",
      contract_id: "con_1",
      product_version: 1,
    });
    mockTx.contract.findUnique.mockResolvedValue({
      id: "con_1",
      status: "DRAFT",
      issuer_organization_id: "org_1",
    });

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_draw" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);

    await expect(
      service.createInvoice("app_draw", "con_1", { number: "INV-1", value: 1000 }, "user_1")
    ).rejects.toMatchObject({ code: "INVALID_CONTRACT_STATUS" });
    expect(mockTx.invoice.create).not.toHaveBeenCalled();
  });

  it("allows existing-facility invoices on an approved facility owned by the issuer", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_draw",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "existing_contract" },
      issuer_organization_id: "org_1",
      contract_id: "con_1",
      product_version: 1,
    });
    mockTx.contract.findUnique.mockResolvedValue({
      id: "con_1",
      status: "APPROVED",
      issuer_organization_id: "org_1",
    });
    mockTx.invoice.create.mockResolvedValue({
      id: "inv_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.invoice.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: "inv_1" });
    mockTx.invoice.update = jest.fn().mockResolvedValue({});

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_draw" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();

    await expect(
      service.createInvoice("app_draw", "con_1", { number: "INV-1", value: 1000 }, "user_1")
    ).resolves.toBeTruthy();
    expect(mockTx.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contract_id: "con_1" }),
    });
  });

  it("links an existing-facility invoice to the application facility when contractId is omitted", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_draw",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "existing_contract" },
      issuer_organization_id: "org_1",
      contract_id: "con_1",
      product_version: 1,
    });
    mockTx.contract.findUnique.mockResolvedValue({
      id: "con_1",
      status: "APPROVED",
      issuer_organization_id: "org_1",
    });
    mockTx.invoice.create.mockResolvedValue({
      id: "inv_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.invoice.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: "inv_1" });
    mockTx.invoice.update = jest.fn().mockResolvedValue({});

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_draw" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();

    await expect(
      service.createInvoice("app_draw", undefined, { number: "INV-1", value: 1000 }, "user_1")
    ).resolves.toBeTruthy();
    expect(mockTx.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contract_id: "con_1" }),
    });
  });

  it("rejects an existing-facility invoice whose contractId does not match the selected facility", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_draw",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "existing_contract" },
      issuer_organization_id: "org_1",
      contract_id: "con_1",
      product_version: 1,
    });

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_draw" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);

    await expect(
      service.createInvoice("app_draw", "con_other", { number: "INV-1", value: 1000 }, "user_1")
    ).rejects.toMatchObject({
      code: "FACILITY_CONTRACT_MISMATCH",
      statusCode: 400,
    } satisfies Partial<AppError>);
    expect(mockTx.invoice.create).not.toHaveBeenCalled();
  });

  it("creates an invoice-only invoice without a facility link", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_invoice_only",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "invoice_only" },
      issuer_organization_id: "org_1",
      contract_id: null,
      product_version: 1,
    });
    mockTx.invoice.create.mockResolvedValue({
      id: "inv_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.invoice.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: "inv_1" });
    mockTx.invoice.update = jest.fn().mockResolvedValue({});

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_invoice_only" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);
    (
      service as unknown as { assertUniqueInvoiceNumberOnFacility: jest.Mock }
    ).assertUniqueInvoiceNumberOnFacility = jest.fn();

    await expect(
      service.createInvoice(
        "app_invoice_only",
        undefined,
        { number: "INV-1", value: 1000 },
        "user_1"
      )
    ).resolves.toBeTruthy();
    expect(mockTx.invoice.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contract_id: undefined }),
    });
  });

  it("rejects a facility link on an invoice-only invoice", async () => {
    mockTx.application.findUnique.mockResolvedValue({
      id: "app_invoice_only",
      financing_type: { split_origination: true, product_code: "ARF" },
      financing_structure: { structure_type: "invoice_only" },
      issuer_organization_id: "org_1",
      contract_id: "holder_1",
      product_version: 1,
    });

    const service = new InvoiceService();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess = jest
      .fn()
      .mockResolvedValue({ id: "app_invoice_only" });
    (service as unknown as { loadWorkflowForApplication: jest.Mock }).loadWorkflowForApplication =
      jest.fn().mockResolvedValue(null);

    await expect(
      service.createInvoice(
        "app_invoice_only",
        "holder_1",
        { number: "INV-1", value: 1000 },
        "user_1"
      )
    ).rejects.toMatchObject({
      code: "STANDALONE_INVOICE_NO_FACILITY",
      statusCode: 400,
    } satisfies Partial<AppError>);
    expect(mockTx.invoice.create).not.toHaveBeenCalled();
  });
});
