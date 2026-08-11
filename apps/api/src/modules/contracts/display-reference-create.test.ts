const mockTx: any = {
  application: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  contract: {
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  displayReferenceAllocation: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
};

const mockPrisma: any = {
  $transaction: jest.fn(async (cb: any) => cb(mockTx)),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { ContractService } from "./service";

describe("ContractService createContract display reference", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTx.application.findUnique.mockReset();
    mockTx.application.update.mockReset();
    mockTx.contract.findUniqueOrThrow.mockReset();
    mockTx.contract.create.mockReset();
    mockTx.contract.update.mockReset();
    mockTx.displayReferenceAllocation.create.mockReset();
    mockTx.displayReferenceAllocation.findUnique.mockReset();
    mockTx.product.findUnique.mockReset();
    mockTx.product.findFirst.mockReset();

    mockTx.application.findUnique.mockResolvedValue({
      id: "app_1",
      issuer_organization_id: "org_1",
      contract_id: null,
      financing_type: { product_id: "prod_1", product_code: "ARF" },
      product_version: 2,
    });
    mockTx.contract.create.mockResolvedValue({
      id: "con_1",
      created_at: new Date("2026-08-10T01:00:00.000Z"),
    });
    mockTx.contract.findUniqueOrThrow.mockResolvedValue({
      id: "con_1",
      display_reference: "CON-ARF-202608-K71",
    });
    mockTx.contract.update.mockResolvedValue({});
    mockTx.displayReferenceAllocation.create.mockResolvedValue({});
    mockTx.displayReferenceAllocation.findUnique.mockResolvedValue(null);
  });

  it("allocates CON reference and keeps linkage transactional", async () => {
    const service = new ContractService();
    (service as any).verifyApplicationAccess = jest.fn(async () => ({ id: "app_1" }));
    (service as any).repository = {
      findByApplicationId: jest.fn(async () => null),
    };

    const result = await service.createContract("app_1", "user_1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.contract.create).toHaveBeenCalledTimes(1);
    expect(mockTx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(mockTx.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "con_1" },
        data: { display_reference: expect.stringMatching(/^CON-ARF-202608-[A-Z0-9]{3}$/) },
      })
    );
    expect(mockTx.application.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app_1" },
      })
    );
    expect(result.display_reference).toBe("CON-ARF-202608-K71");
  });

  it("fails when application product code cannot be resolved", async () => {
    const service = new ContractService();
    (service as any).verifyApplicationAccess = jest.fn(async () => ({ id: "app_1" }));
    (service as any).repository = {
      findByApplicationId: jest.fn(async () => null),
    };
    mockTx.application.findUnique.mockResolvedValueOnce({
      id: "app_1",
      issuer_organization_id: "org_1",
      contract_id: null,
      financing_type: { product_id: "prod_1" },
      product_version: 2,
    });
    mockTx.product.findUnique.mockResolvedValueOnce({
      id: "prod_1",
      base_id: "prod_1",
      product_code: null,
    });
    mockTx.product.findFirst.mockResolvedValueOnce(null);

    await expect(service.createContract("app_1", "user_1")).rejects.toThrow(
      "Application product code is missing"
    );
    expect(mockTx.contract.create).not.toHaveBeenCalled();
  });
});
