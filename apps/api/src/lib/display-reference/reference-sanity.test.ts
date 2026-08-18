import { checkDisplayReferenceSanity } from "./reference-sanity";

const mockDb: any = {
  displayReferenceAllocation: {
    findMany: jest.fn(),
  },
  application: { findMany: jest.fn() },
  contract: { findMany: jest.fn() },
  invoice: { findMany: jest.fn() },
  note: { findMany: jest.fn() },
  noteSettlement: { findMany: jest.fn() },
  withdrawalInstruction: { findMany: jest.fn() },
  issuerOrganization: { findMany: jest.fn() },
  investorOrganization: { findMany: jest.fn() },
  gatewayPaymentReceipt: { findMany: jest.fn(), findUnique: jest.fn() },
};

describe("checkDisplayReferenceSanity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.application.findMany.mockResolvedValue([]);
    mockDb.contract.findMany.mockResolvedValue([]);
    mockDb.invoice.findMany.mockResolvedValue([]);
    mockDb.note.findMany.mockResolvedValue([]);
    mockDb.noteSettlement.findMany.mockResolvedValue([]);
    mockDb.withdrawalInstruction.findMany.mockResolvedValue([]);
    mockDb.issuerOrganization.findMany.mockResolvedValue([]);
    mockDb.investorOrganization.findMany.mockResolvedValue([]);
    mockDb.gatewayPaymentReceipt.findMany.mockResolvedValue([]);
    mockDb.gatewayPaymentReceipt.findUnique.mockResolvedValue(null);
  });

  it("flags malformed allocations and module mismatches", async () => {
    mockDb.displayReferenceAllocation.findMany.mockResolvedValue([
      {
        id: "alloc_1",
        display_reference: "APP-ARF-202608-ABC",
        module_code: "CON",
        product_code: "ARF",
        entity_type: "application",
        entity_id: "app_1",
        allocated_at: new Date(),
      },
      {
        id: "alloc_2",
        display_reference: "IVT-202608-XYZ",
        module_code: "IVT",
        product_code: "ARF",
        entity_type: "investor_organization",
        entity_id: "inv_org_1",
        allocated_at: new Date(),
      },
    ]);
    mockDb.application.findUnique = jest.fn().mockResolvedValue({
      display_reference: "APP-ARF-202608-ABC",
    });
    mockDb.investorOrganization.findUnique = jest.fn().mockResolvedValue({
      display_reference: "IVT-202608-XYZ",
    });
    mockDb.contract.findUnique = jest.fn();
    mockDb.invoice.findUnique = jest.fn();
    mockDb.note.findUnique = jest.fn();
    mockDb.noteSettlement.findUnique = jest.fn();
    mockDb.withdrawalInstruction.findUnique = jest.fn();
    mockDb.issuerOrganization.findUnique = jest.fn();

    const report = await checkDisplayReferenceSanity(mockDb);

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "MODULE_MISMATCH")).toBe(true);
    expect(report.issues.some((issue) => issue.code === "ORGANIZATION_HAS_PRODUCT_CODE")).toBe(
      true
    );
  });

  it("accepts canonical RCP allocations and ignores legacy daily receipt numbers", async () => {
    mockDb.displayReferenceAllocation.findMany.mockResolvedValue([
      {
        id: "alloc_rcp",
        display_reference: "RCP-202608-K7P",
        module_code: "RCP",
        product_code: null,
        entity_type: "gateway_payment_receipt",
        entity_id: "rcp_new",
        allocated_at: new Date(),
      },
    ]);
    mockDb.gatewayPaymentReceipt.findUnique.mockResolvedValue({
      receipt_number: "RCP-202608-K7P",
    });
    mockDb.gatewayPaymentReceipt.findMany.mockResolvedValue([
      { id: "rcp_new", receipt_number: "RCP-202608-K7P" },
      { id: "rcp_old", receipt_number: "RCP-20260803-001" },
    ]);
    mockDb.application.findUnique = jest.fn();
    mockDb.contract.findUnique = jest.fn();
    mockDb.invoice.findUnique = jest.fn();
    mockDb.note.findUnique = jest.fn();
    mockDb.noteSettlement.findUnique = jest.fn();
    mockDb.withdrawalInstruction.findUnique = jest.fn();
    mockDb.issuerOrganization.findUnique = jest.fn();
    mockDb.investorOrganization.findUnique = jest.fn();

    const report = await checkDisplayReferenceSanity(mockDb);

    expect(report.ok).toBe(true);
    expect(report.issues.some((issue) => issue.code === "ALLOCATION_ROW_MISSING")).toBe(false);
  });

  it("flags product_code on RCP allocations", async () => {
    mockDb.displayReferenceAllocation.findMany.mockResolvedValue([
      {
        id: "alloc_rcp",
        display_reference: "RCP-202608-K7P",
        module_code: "RCP",
        product_code: "ARF",
        entity_type: "gateway_payment_receipt",
        entity_id: "rcp_new",
        allocated_at: new Date(),
      },
    ]);
    mockDb.gatewayPaymentReceipt.findUnique.mockResolvedValue({
      receipt_number: "RCP-202608-K7P",
    });
    mockDb.gatewayPaymentReceipt.findMany.mockResolvedValue([
      { id: "rcp_new", receipt_number: "RCP-202608-K7P" },
    ]);
    mockDb.application.findUnique = jest.fn();
    mockDb.contract.findUnique = jest.fn();
    mockDb.invoice.findUnique = jest.fn();
    mockDb.note.findUnique = jest.fn();
    mockDb.noteSettlement.findUnique = jest.fn();
    mockDb.withdrawalInstruction.findUnique = jest.fn();
    mockDb.issuerOrganization.findUnique = jest.fn();
    mockDb.investorOrganization.findUnique = jest.fn();

    const report = await checkDisplayReferenceSanity(mockDb);

    expect(report.ok).toBe(false);
    expect(report.issues.some((issue) => issue.code === "RECEIPT_HAS_PRODUCT_CODE")).toBe(true);
  });
});
