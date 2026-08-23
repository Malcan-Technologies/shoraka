import { AppError } from "../../lib/http/error-handler";

const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockApplicationUpdate = jest.fn();
const mockSigningEnvelopeFindMany = jest.fn();
const mockTransaction = jest.fn();
const mockVerifyApplicationAccess = jest.fn();
const mockWriteApplicationAuditLog = jest.fn();

jest.mock("./repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindById(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  })),
}));

jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../contracts/repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("./audit/writer", () => ({
  APPLICATION_AUDIT_TARGET_TYPE: { APPLICATION: "APPLICATION" },
  issuerApplicationAuditContext: (userId: string) => ({ actorUserId: userId }),
  writeApplicationAuditLog: (...args: unknown[]) => mockWriteApplicationAuditLog(...args),
  writeApplicationDocumentAuditLogs: jest.fn(),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    signingEnvelope: {
      findMany: (...args: unknown[]) => mockSigningEnvelopeFindMany(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
  },
}));

import { ApplicationService } from "./service";

describe("ApplicationService origination guards", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyApplicationAccess.mockResolvedValue(undefined);
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      mockVerifyApplicationAccess;
  });

  it("archiveApplication preserves terminal status for closed files", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "COMPLETED",
      archived_at: null,
      contract: { status: "APPROVED" },
      invoices: [{ status: "REJECTED" }],
      financing_structure: { structure_type: "new_contract" },
    });
    mockSigningEnvelopeFindMany.mockResolvedValue([]);
    mockApplicationUpdate.mockResolvedValue({
      id: "app-1",
      status: "COMPLETED",
      archived_at: new Date("2026-08-20T00:00:00.000Z"),
    });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        application: { update: mockApplicationUpdate },
      })
    );

    const result = await service.archiveApplication("app-1", "user-1");

    expect(mockApplicationUpdate).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: expect.objectContaining({
        archived_at: expect.any(Date),
      }),
    });
    expect(mockWriteApplicationAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "APPLICATION_ARCHIVED",
        metadata: expect.objectContaining({
          previousStatus: "COMPLETED",
          archivedAt: expect.any(String),
        }),
      }),
      expect.anything()
    );
    expect(result.status).toBe("COMPLETED");
  });

  it("cancelApplication rejects withdraw in approved phase", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "INVOICE_PENDING",
      contract: { id: "con-1", status: "APPROVED" },
      invoices: [],
      financing_structure: { structure_type: "new_contract" },
    });
    mockSigningEnvelopeFindMany.mockResolvedValue([]);

    await expect(service.cancelApplication("app-1", "user-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "BAD_REQUEST",
    } satisfies Partial<AppError>);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
