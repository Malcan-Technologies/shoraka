import { createProductBodySchema } from "./schemas";

describe("product schemas product_code validation", () => {
  const baseBody = {
    workflow: [{ name: "Financing type", config: { category: "Working Capital", name: "ARF" } }],
  };

  it("requires product_code on create", () => {
    expect(() => createProductBodySchema.parse(baseBody)).toThrow();
  });

  it("accepts valid uppercase product_code on create", () => {
    const parsed = createProductBodySchema.parse({
      ...baseBody,
      product_code: "arf",
    });
    expect(parsed.product_code).toBe("ARF");
  });

  it("rejects invalid product_code format", () => {
    expect(() =>
      createProductBodySchema.parse({
        ...baseBody,
        product_code: "A",
      })
    ).toThrow();
  });
});
