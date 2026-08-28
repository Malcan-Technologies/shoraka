import {
  CurlecGatewayAccount,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
} from "@prisma/client";
import {
  buildCorporateBusinessNameJsonFilters,
  buildGatewayPaymentSearchOr,
  matchGatewayAccountsFromSearch,
  matchPurposesFromSearch,
  parseSearchAmount,
} from "./gateway-payment-list-search";

function orgBusinessNameFilters(
  orgClause: Prisma.GatewayPaymentWhereInput | undefined
): Array<{ path?: string[]; string_contains?: string }> {
  if (!orgClause || !("investor_organization" in orgClause)) return [];
  const org = orgClause.investor_organization;
  if (!org || typeof org !== "object" || !("OR" in org) || !Array.isArray(org.OR)) {
    return [];
  }
  return org.OR.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !("corporate_onboarding_data" in entry)) {
      return [];
    }
    const json = entry.corporate_onboarding_data;
    if (!json || typeof json !== "object") return [];
    return [json as { path?: string[]; string_contains?: string }];
  });
}

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
      expect(matchPurposesFromSearch("facility fee")).toContain(GatewayPaymentPurpose.FACILITY_FEE);
      expect(matchPurposesFromSearch("late charges")).toContain(
        GatewayPaymentPurpose.EXCESS_LATE_CHARGES
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

  describe("corporate businessName search", () => {
    it("targets corporate_onboarding_data.basicInfo.businessName", () => {
      const filters = buildCorporateBusinessNameJsonFilters("Acme Trading Sdn Bhd");
      expect(filters.length).toBeGreaterThan(0);
      expect(filters[0]?.corporate_onboarding_data.path).toEqual([
        "basicInfo",
        "businessName",
      ]);
    });

    it("includes exact visible businessName text", () => {
      const filters = buildCorporateBusinessNameJsonFilters("Acme Trading Sdn Bhd");
      expect(
        filters.some((f) => f.corporate_onboarding_data.string_contains === "Acme Trading Sdn Bhd")
      ).toBe(true);
    });

    it("supports partial businessName", () => {
      const filters = buildCorporateBusinessNameJsonFilters("Acme");
      expect(
        filters.some((f) => f.corporate_onboarding_data.string_contains === "Acme")
      ).toBe(true);
    });

    it("includes case variants for case-insensitive matching on Prisma 5", () => {
      const filters = buildCorporateBusinessNameJsonFilters("Acme Trading");
      const values = filters.map((f) => f.corporate_onboarding_data.string_contains);
      expect(values).toEqual(
        expect.arrayContaining(["Acme Trading", "acme trading", "ACME TRADING"])
      );
    });

    it("returns no JSON filters for blank/missing businessName search", () => {
      expect(buildCorporateBusinessNameJsonFilters("")).toEqual([]);
      expect(buildCorporateBusinessNameJsonFilters("   ")).toEqual([]);
    });

    it("embeds businessName JSON filters in investor and issuer org search", () => {
      const or = buildGatewayPaymentSearchOr("Acme Trading");
      const investor = or.find((clause) => "investor_organization" in clause);
      const issuer = or.find((clause) => "issuer_organization" in clause);

      const investorJson = orgBusinessNameFilters(investor);
      expect(investorJson.length).toBeGreaterThan(0);
      expect(investorJson[0]?.path).toEqual(["basicInfo", "businessName"]);

      expect(issuer && "issuer_organization" in issuer).toBe(true);
      const issuerOrg = issuer?.issuer_organization as { OR?: unknown[] } | undefined;
      const issuerJson =
        issuerOrg?.OR?.filter(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            "corporate_onboarding_data" in entry
        ) ?? [];
      expect(issuerJson.length).toBeGreaterThan(0);
    });

    it("does not invent a match clause for unrelated text beyond normal OR search", () => {
      const or = buildGatewayPaymentSearchOr("zzzz-no-such-business");
      const investorJson = orgBusinessNameFilters(
        or.find((clause) => "investor_organization" in clause)
      );
      // Conditions are still emitted; matching rows is a DB concern.
      // Ensure path is correct and only the search term variants are used.
      expect(
        investorJson.every((f) => f.string_contains?.includes("zzzz-no-such-business") ||
          f.string_contains?.includes("ZZZZ-NO-SUCH-BUSINESS") ||
          f.string_contains?.includes("Zzzz-No-Such-Business"))
      ).toBe(true);
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

    it("includes CashSouk application, facility, and note references", () => {
      const or = buildGatewayPaymentSearchOr("APP-ARF-202608-A82");
      expect(or.some((clause) => "application" in clause)).toBe(true);
      expect(or.some((clause) => "contract" in clause)).toBe(true);
      expect(or.some((clause) => "note" in clause)).toBe(true);
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

    it("keeps businessName search combinable with status filter (AND at list layer)", () => {
      const searchOr = buildGatewayPaymentSearchOr("Acme Trading");
      const where: Prisma.GatewayPaymentWhereInput = {
        status: { in: [GatewayPaymentStatus.NAME_CHECK_PENDING] },
        OR: searchOr,
      };
      expect(where.status).toEqual({ in: [GatewayPaymentStatus.NAME_CHECK_PENDING] });
      expect(where.OR?.some((clause) => "investor_organization" in clause)).toBe(true);
      expect(orgBusinessNameFilters(where.OR?.find((c) => "investor_organization" in c))).not.toHaveLength(
        0
      );
    });

    it("keeps businessName search combinable with account filter (AND at list layer)", () => {
      const searchOr = buildGatewayPaymentSearchOr("Acme Trading");
      const where: Prisma.GatewayPaymentWhereInput = {
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        OR: searchOr,
      };
      expect(where.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);
      expect(where.OR?.some((clause) => "issuer_organization" in clause)).toBe(true);
    });
  });
});
