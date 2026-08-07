import {
  CurlecGatewayAccount,
  GatewayPaymentPurpose,
} from "@prisma/client";
import {
  buildGatewayPaymentSearchOr,
  matchGatewayAccountsFromSearch,
  matchPurposesFromSearch,
  parseSearchAmount,
} from "./gateway-payment-list-search";

describe("gateway-payment-list-search", () => {
  describe("parseSearchAmount", () => {
    it.each([
      ["100", "100"],
      ["100.00", "100"],
      ["RM100", "100"],
      ["RM 100", "100"],
      ["MYR100", "100"],
      ["MYR 100", "100"],
      ["RM 1,000.50", "1000.5"],
    ])("parses %s", (input, expected) => {
      expect(parseSearchAmount(input)?.toString()).toBe(expected);
    });

    it.each(["", "abc", "RM", "1.2.3", "RM abc"])("rejects %s", (input) => {
      expect(parseSearchAmount(input)).toBeNull();
    });
  });

  describe("matchPurposesFromSearch", () => {
    it("matches purpose labels and aliases", () => {
      expect(matchPurposesFromSearch("investor deposit")).toContain(
        GatewayPaymentPurpose.INVESTOR_DEPOSIT
      );
      expect(matchPurposesFromSearch("Issuer Registration Fee")).toContain(
        GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE
      );
      expect(matchPurposesFromSearch("processing fee")).toContain(
        GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE
      );
    });

    it("ignores short terms", () => {
      expect(matchPurposesFromSearch("fe")).toEqual([]);
    });
  });

  describe("matchGatewayAccountsFromSearch", () => {
    it("matches operating and investor pool labels", () => {
      expect(matchGatewayAccountsFromSearch("Operating")).toEqual([
        CurlecGatewayAccount.OPERATING,
      ]);
      expect(matchGatewayAccountsFromSearch("investor pool")).toEqual([
        CurlecGatewayAccount.INVESTOR_POOL,
      ]);
    });
  });

  describe("buildGatewayPaymentSearchOr", () => {
    it("returns empty for blank search", () => {
      expect(buildGatewayPaymentSearchOr("   ")).toEqual([]);
    });

    it("includes reference, org, and amount conditions", () => {
      const or = buildGatewayPaymentSearchOr("pay_abc123");
      expect(or.some((clause) => "curlec_payment_id" in clause)).toBe(true);
      expect(or.some((clause) => "curlec_order_id" in clause)).toBe(true);
      expect(or.some((clause) => "refund_reference" in clause)).toBe(true);
      expect(or.some((clause) => "settlement_id" in clause)).toBe(true);
      expect(or.some((clause) => "investor_organization" in clause)).toBe(true);
      expect(or.some((clause) => "issuer_organization" in clause)).toBe(true);
    });

    it("adds exact amount clause for numeric search", () => {
      const or = buildGatewayPaymentSearchOr("RM 100.00");
      expect(or.some((clause) => "amount" in clause)).toBe(true);
    });

    it("adds purpose clause for purpose label search", () => {
      const or = buildGatewayPaymentSearchOr("investor deposit");
      expect(
        or.some(
          (clause) =>
            "purpose" in clause &&
            clause.purpose === GatewayPaymentPurpose.INVESTOR_DEPOSIT
        )
      ).toBe(true);
    });
  });
});
