const mockApply = jest.fn(
  async (_id: string, _db: unknown, mutate: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      applicationReviewRemark: { deleteMany: jest.fn() },
      applicationReviewItem: { deleteMany: jest.fn() },
      applicationReview: { deleteMany: jest.fn() },
      applicationRevision: { create: jest.fn().mockResolvedValue({ id: "rev-2" }) },
      application: { update: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    await mutate(tx);
    return { result: undefined, snapshot: null };
  }
);
const mockFindById = jest.fn();
const mockPrismaTransaction = jest.fn();

jest.mock("../../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: (...args: unknown[]) => mockApply(...args),
}));

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    applicationReviewRemark: { findMany: jest.fn().mockResolvedValue([]) },
    product: { findUnique: jest.fn().mockResolvedValue(null) },
    application: { findUnique: jest.fn() },
    applicationRevision: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}));

jest.mock("../issuer-organization-financial-statements", () => ({
  upsertLatestOrganizationFinancialStatementsFromApplication: jest.fn(),
}));

jest.mock("../audit/writer", () => ({
  APPLICATION_AUDIT_TARGET_TYPE: { APPLICATION: "APPLICATION" },
  issuerApplicationAuditContext: (userId: string) => ({ actorUserId: userId }),
  writeApplicationAuditLog: jest.fn(),
}));

jest.mock("../supporting-docs-workflow", () => ({
  assertRequiredSupportingDocumentsPresent: jest.fn(),
}));

import { resubmitApplication } from "./service";
import { prisma } from "../../../lib/prisma";

describe("amendment resubmit capacity", () => {
  const repository = {
    findById: (...args: unknown[]) => mockFindById(...args),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "AMENDMENT_REQUESTED",
      review_cycle: 1,
      amendment_acknowledged_workflow_ids: [],
      financing_type: { product_id: "prod-1" },
      supporting_documents: {},
    });
  });

  it("re-reserves occupancy through applyContractCapacityChange when a facility is linked", async () => {
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      id: "app-1",
      contract_id: "contract-1",
      financing_type: { product_id: "prod-1" },
      product_version: 1,
      amendment_acknowledged_workflow_ids: [],
      financing_structure: { structure_type: "existing_contract" },
      company_details: {},
      business_details: {},
      application_guarantors: [],
      financial_statements: {},
      supporting_documents: {},
      declarations: {},
      review_and_submit: {},
      last_completed_step: 4,
      contract: { id: "contract-1" },
      invoices: [{ id: "inv-1", status: "AMENDMENT_REQUESTED" }],
      issuer_organization: { id: "org-1" },
    });

    await resubmitApplication("app-1", "user-1", repository as never);

    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      prisma,
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it("skips the capacity lock when resubmitting an invoice-only application", async () => {
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      id: "app-1",
      contract_id: null,
      financing_type: { product_id: "prod-1" },
      product_version: 1,
      amendment_acknowledged_workflow_ids: [],
      financing_structure: { structure_type: "invoice_only" },
      company_details: {},
      business_details: {},
      application_guarantors: [],
      financial_statements: {},
      supporting_documents: {},
      declarations: {},
      review_and_submit: {},
      last_completed_step: 3,
      contract: null,
      invoices: [{ id: "inv-1", status: "AMENDMENT_REQUESTED" }],
      issuer_organization: { id: "org-1" },
    });
    mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        applicationReviewRemark: { deleteMany: jest.fn() },
        applicationReviewItem: { deleteMany: jest.fn() },
        applicationReview: { deleteMany: jest.fn() },
        applicationRevision: { create: jest.fn().mockResolvedValue({ id: "rev-2" }) },
        application: { update: jest.fn() },
      })
    );

    await resubmitApplication("app-1", "user-1", repository as never);

    expect(mockApply).not.toHaveBeenCalled();
    expect(mockPrismaTransaction).toHaveBeenCalled();
  });
});
