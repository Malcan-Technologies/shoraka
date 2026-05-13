// Mock prisma so ProductRepository.create() can be tested without a real DB.
const mockTx: any = {
  $queryRaw: jest.fn(),
  product: {
    create: jest.fn(),
    update: jest.fn(),
  },
  productLog: {
    create: jest.fn(),
  },
};

const mockPrisma: any = {
  $transaction: jest.fn((cb: any) => cb(mockTx)),
};

jest.mock("../../lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { ProductRepository } from "./repository";

describe("ProductRepository.create PRODUCT_CREATED logging", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // MAX(product_display_order) -> nextProductOrder
    mockTx.$queryRaw.mockImplementationOnce(async () => [{ max: 5 }]);
    // MIN(category_display_order) -> null means fall back to global MAX
    mockTx.$queryRaw.mockImplementationOnce(async () => [{ min: null }]);
    // MAX(category_display_order) -> used when MIN is null
    mockTx.$queryRaw.mockImplementationOnce(async () => [{ max: 1 }]);

    const created_at = new Date("2026-05-13T10:00:00.000Z");
    const updated_at = new Date("2026-05-13T10:00:05.000Z");

    mockTx.product.create.mockImplementationOnce(async ({ data }: any) => {
      return {
        id: "prod_new_1",
        version: data.version,
        workflow: data.workflow,
        category_display_order: data.category_display_order,
        product_display_order: data.product_display_order,
        offer_expiry_days: data.offer_expiry_days ?? null,
        status: "ACTIVE",
        base_id: null,
        created_at,
        updated_at,
      };
    });

    mockTx.product.update.mockImplementationOnce(async () => {
      return {};
    });
  });

  it("writes PRODUCT_CREATED with product config metadata", async () => {
    const repo = new ProductRepository();
    const workflow = [
      {
        name: "Financing type",
        config: {
          category: "Invoice financing",
        },
      },
    ];

    await repo.create(
      { workflow, offer_expiry_days: 14 },
      {
        userId: "admin_user_1",
        ipAddress: "203.0.113.10",
        userAgent: "test-agent",
        deviceInfo: "device-1",
      }
    );

    expect(mockTx.productLog.create).toHaveBeenCalledTimes(1);
    const call = mockTx.productLog.create.mock.calls[0][0];

    expect(call.data.event_type).toBe("PRODUCT_CREATED");
    expect(call.data.product_id).toBe("prod_new_1");
    expect(call.data.user_id).toBe("admin_user_1");

    const meta = call.data.metadata;
    expect(meta.workflow).toEqual(workflow);
    expect(meta.category_display_order).toBe(2); // global max (1) + 1 due to MIN(null) fallback
    expect(meta.product_display_order).toBe(6); // (max 5) + 1
    expect(meta.offer_expiry_days).toBe(14);
    expect(meta.version).toBe(1);
    expect(meta.base_id).toBe("prod_new_1");
    expect(meta.status).toBe("ACTIVE");
    expect(meta.product_created_at).toBe("2026-05-13T10:00:00.000Z");
    expect(meta.product_updated_at).toBe("2026-05-13T10:00:05.000Z");
  });
});

