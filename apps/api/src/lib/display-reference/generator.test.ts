import {
  DisplayReferenceExhaustedError,
  allocateDisplayReference,
  generateDisplayReference,
  getMalaysiaYearMonth,
} from "./generator";
import type { AllocateDisplayReferenceInput } from "./types";

describe("display-reference generator", () => {
  it.each(["APP", "CON", "INV", "NOTE", "SET", "WDL"] as const)(
    "generates product-scoped format for %s",
    (moduleCode) => {
      const ref = generateDisplayReference({
        moduleCode,
        productCode: "arf",
        referenceDate: new Date("2026-08-10T01:00:00Z"),
      });
      expect(ref).toMatch(new RegExp(`^${moduleCode}-ARF-202608-[A-Z0-9]{3}$`));
    }
  );

  it.each(["ISS", "IVT"] as const)(
    "generates organization format for %s",
    (moduleCode) => {
      const ref = generateDisplayReference({
        moduleCode,
        referenceDate: new Date("2026-08-10T01:00:00Z"),
      });
      expect(ref).toMatch(new RegExp(`^${moduleCode}-202608-[A-Z0-9]{3}$`));
      expect(ref).not.toContain("-ARF-");
      expect(ref).not.toContain("-GEN-");
    }
  );

  it("fails when product-scoped module has no product code", () => {
    expect(() =>
      generateDisplayReference({
        moduleCode: "APP",
        referenceDate: new Date("2026-08-10T01:00:00Z"),
      } as unknown as any)
    ).toThrow();
  });

  it("rejects product code for organization module at runtime", () => {
    expect(() =>
      generateDisplayReference({
        moduleCode: "ISS",
        productCode: "ARF",
        referenceDate: new Date("2026-08-10T01:00:00Z"),
      } as unknown as any)
    ).toThrow("must not include a product code");
  });

  it("uses Malaysia timezone for YYYYMM boundaries", () => {
    // 2026-07-31 16:30 UTC = 2026-08-01 00:30 MY
    const ym = getMalaysiaYearMonth(new Date("2026-07-31T16:30:00.000Z"));
    expect(ym).toBe("202608");
  });
});

describe("display-reference allocator", () => {
  function buildInput(
    tx: any,
    overrides: Partial<AllocateDisplayReferenceInput> = {}
  ): AllocateDisplayReferenceInput {
    return {
      moduleCode: "APP",
      productCode: "ARF",
      referenceDate: new Date("2026-08-10T01:00:00.000Z"),
      entityType: "application",
      entityId: "app_1",
      tx,
      ...overrides,
    } as AllocateDisplayReferenceInput;
  }

  it("allocates and stores metadata for product-scoped module", async () => {
    const tx = {
      displayReferenceAllocation: {
        create: jest.fn(async () => ({})),
      },
    };
    const persist = jest.fn(async () => undefined);
    const input = buildInput(tx);

    const ref = await allocateDisplayReference(input, persist);

    expect(ref).toMatch(/^APP-ARF-202608-[A-Z0-9]{3}$/);
    expect(tx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(tx.displayReferenceAllocation.create.mock.calls[0][0].data.product_code).toBe("ARF");
    expect(persist).toHaveBeenCalledWith(tx, ref);
  });

  it("stores null product_code for organization modules", async () => {
    const tx = {
      displayReferenceAllocation: {
        create: jest.fn(async () => ({})),
      },
    };
    const persist = jest.fn(async () => undefined);
    const input: AllocateDisplayReferenceInput = {
      moduleCode: "ISS",
      referenceDate: new Date("2026-08-10T01:00:00.000Z"),
      entityType: "issuer_organization",
      entityId: "org_1",
      tx: tx as any,
    };

    const ref = await allocateDisplayReference(input, persist);

    expect(ref).toMatch(/^ISS-202608-[A-Z0-9]{3}$/);
    expect(tx.displayReferenceAllocation.create.mock.calls[0][0].data.product_code).toBeNull();
  });

  it("retries on unique collisions and succeeds", async () => {
    const tx = {
      displayReferenceAllocation: {
        create: jest
          .fn()
          .mockRejectedValueOnce({ code: "P2002" })
          .mockResolvedValueOnce({}),
      },
    };
    const persist = jest.fn(async () => undefined);
    const input = buildInput(tx);

    const ref = await allocateDisplayReference(input, persist);

    expect(ref).toMatch(/^APP-ARF-202608-[A-Z0-9]{3}$/);
    expect(tx.displayReferenceAllocation.create).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("does not retry unrelated errors", async () => {
    const tx = {
      displayReferenceAllocation: {
        create: jest.fn().mockRejectedValue(new Error("db offline")),
      },
    };
    const persist = jest.fn(async () => undefined);
    const input = buildInput(tx);

    await expect(allocateDisplayReference(input, persist)).rejects.toThrow("db offline");
    expect(tx.displayReferenceAllocation.create).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
  });

  it("fails with exhaustion after retry limit", async () => {
    const tx = {
      displayReferenceAllocation: {
        create: jest.fn().mockRejectedValue({ code: "P2002" }),
      },
    };
    const persist = jest.fn(async () => undefined);
    const input = buildInput(tx);

    await expect(allocateDisplayReference(input, persist)).rejects.toBeInstanceOf(
      DisplayReferenceExhaustedError
    );
    expect(tx.displayReferenceAllocation.create).toHaveBeenCalledTimes(10);
    expect(persist).not.toHaveBeenCalled();
  });
});
