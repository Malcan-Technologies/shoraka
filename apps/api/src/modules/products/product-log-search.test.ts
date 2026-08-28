import { buildProductLogSearchOr } from "./product-log-search";

describe("product log search", () => {
  it("searches actor, email, and product ID", () => {
    const or = buildProductLogSearchOr("Ada", []);
    expect(or).toEqual(
      expect.arrayContaining([
        { user: { email: { contains: "Ada", mode: "insensitive" } } },
        { user: { first_name: { contains: "Ada", mode: "insensitive" } } },
        { user: { last_name: { contains: "Ada", mode: "insensitive" } } },
        { product_id: { contains: "Ada", mode: "insensitive" } },
      ])
    );
    expect(or.some((clause) => "id" in clause)).toBe(false);
  });

  it("includes name-matched log ids without replacing ID search", () => {
    const or = buildProductLogSearchOr("Invoice Financing", ["log_1", "log_2"]);
    expect(or).toContainEqual({ id: { in: ["log_1", "log_2"] } });
    expect(or).toContainEqual({
      product_id: { contains: "Invoice Financing", mode: "insensitive" },
    });
  });
});
