import { listGatewayPaymentsQuerySchema } from "./admin-schemas";

describe("listGatewayPaymentsQuerySchema", () => {
  it("accepts exceptions without replacing needs_attention or review", () => {
    expect(listGatewayPaymentsQuerySchema.parse({ filter: "exceptions" }).filter).toBe(
      "exceptions"
    );
    expect(listGatewayPaymentsQuerySchema.parse({ filter: "needs_attention" }).filter).toBe(
      "needs_attention"
    );
    expect(listGatewayPaymentsQuerySchema.parse({ filter: "review" }).filter).toBe("review");
  });

  it("rejects unknown filters", () => {
    expect(() => listGatewayPaymentsQuerySchema.parse({ filter: "held" })).toThrow();
  });
});
