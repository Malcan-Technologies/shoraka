import { allocateProRataNoteMoney } from "@cashsouk/types";
import { calculateCeilingAwareGrossProfit } from "../calculators";
import {
  allocateCertificateInvestors,
  assertCertificateReconciliation,
  calculateCertificateContractedProfit,
} from "./calculations";
import { CertificateGenerationError } from "./types";

describe("calculateCertificateContractedProfit", () => {
  it("uses calculateCeilingAwareGrossProfit with funded principal, rate, tenure and invoice ceiling", () => {
    const input = {
      fundedPrincipal: 80_000,
      annualRatePercent: 12,
      tenureDays: 90,
      invoiceFaceValue: 100_000,
    };
    const expected = calculateCeilingAwareGrossProfit({
      fundedPrincipal: input.fundedPrincipal,
      annualRatePercent: input.annualRatePercent,
      profitDays: input.tenureDays,
      invoiceFaceValue: input.invoiceFaceValue,
    });
    const result = calculateCertificateContractedProfit(input);
    expect(result.contractedProfit).toBeCloseTo(expected.investorProfitGross, 2);
    expect(result.capped).toBe(expected.capped);
  });
});

describe("allocateCertificateInvestors", () => {
  it("reconciles principal, 100.00% share, gross profit and totals", () => {
    const fundedPrincipal = 100_000;
    const contractedProfit = 2_465.75;
    const investors = allocateCertificateInvestors({
      fundedPrincipal,
      contractedProfit,
      investments: [
        {
          investorOrganizationId: "org-a",
          investorReference: "IVT-A",
          investorName: "Alice Tan",
          amount: 40_000,
        },
        {
          investorOrganizationId: "org-b",
          investorReference: "IVT-B",
          investorName: "Bob Lee",
          amount: 35_000,
        },
        {
          investorOrganizationId: "org-c",
          investorReference: "IVT-C",
          investorName: "Cara Ng",
          amount: 25_000,
        },
      ],
    });

    expect(allocateProRataNoteMoney(100, investors.map((row) => row.principal)).reduce((a, b) => a + b, 0)).toBe(
      100
    );
    expect(investors.reduce((sum, row) => sum + row.sharePercent, 0)).toBe(100);
    expect(investors.reduce((sum, row) => sum + row.principal, 0)).toBe(fundedPrincipal);
    expect(investors.reduce((sum, row) => sum + row.expectedGrossProfit, 0)).toBe(contractedProfit);
    expect(
      investors.reduce((sum, row) => sum + row.totalPayable, 0)
    ).toBeCloseTo(fundedPrincipal + contractedProfit, 2);

    expect(() =>
      assertCertificateReconciliation({
        fundedPrincipal,
        contractedProfit,
        totalAmountPayable: fundedPrincipal + contractedProfit,
        investors,
      })
    ).not.toThrow();
  });

  it("does not use stored target-based allocation percents", () => {
    const investors = allocateCertificateInvestors({
      fundedPrincipal: 80_000,
      contractedProfit: 1_000,
      investments: [
        {
          investorOrganizationId: "org-a",
          investorReference: "IVT-A",
          investorName: "Alice",
          amount: 80_000,
        },
      ],
    });
    expect(investors[0]?.sharePercent).toBe(100);
    expect(investors[0]?.principal).toBe(80_000);
  });

  it("fails reconciliation when principals do not match funded amount", () => {
    expect(() =>
      assertCertificateReconciliation({
        fundedPrincipal: 100,
        contractedProfit: 10,
        totalAmountPayable: 110,
        investors: [
          {
            investorOrganizationId: "org-a",
            investorReference: "IVT-A",
            investorName: "Alice",
            principal: 90,
            sharePercent: 100,
            expectedGrossProfit: 10,
            totalPayable: 100,
          },
        ],
      })
    ).toThrow(CertificateGenerationError);
  });
});
