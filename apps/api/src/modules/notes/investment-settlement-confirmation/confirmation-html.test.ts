import {
  INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
} from "@cashsouk/types";
import { buildInvestmentSettlementConfirmationHtml } from "./confirmation-html";
import type { InvestmentSettlementConfirmationSnapshot } from "./types";

function snapshot(
  overrides: Partial<InvestmentSettlementConfirmationSnapshot> = {}
): InvestmentSettlementConfirmationSnapshot {
  return {
    templateId: "investment-settlement-confirmation-investor-v1",
    templateVersion: "V01",
    snapshotGeneratedAt: "2026-09-02T03:00:00.000Z",
    snapshotSha256: "abc",
    source: "SETTLEMENT_POSTED",
    version: "V01",
    noteId: "note-1",
    noteReference: "ARF-202608-A52",
    settlementId: "set-1",
    settlementReference: "SET-ARF-202608-A52",
    investorOrganizationId: "org-a",
    investorReference: "IVT-1",
    investmentIds: ["inv-1"],
    issuerReference: "ISS-202608-DK3",
    settlementDate: "2026-08-20T00:00:00.000Z",
    settlementDateDisplay: "20 Aug 2026",
    settlementDateSource: "ACTUAL_SETTLEMENT_DATE",
    principalReturned: 10000,
    grossProfitEarned: 750,
    serviceFeeRatePercent: 15,
    serviceFeeLabel: "Service fee (15% of profit)",
    serviceFeeAmount: 112.5,
    netProfitCredited: 637.5,
    tawidhCompensation: 0,
    showTawidh: false,
    totalCreditedToWallet: 10637.5,
    walletTransactionIds: ["tx-1"],
    statusLabel: "Settled",
    introCopy: INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
    processingNotice: INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
    ...overrides,
  };
}

describe("buildInvestmentSettlementConfirmationHtml", () => {
  it("renders frozen system values and approved copy without web buttons", () => {
    const html = buildInvestmentSettlementConfirmationHtml(snapshot());
    expect(html).toContain("Investment Settlement Confirmation");
    expect(html).toContain("ARF-202608-A52");
    expect(html).toContain("ISS-202608-DK3");
    expect(html).toContain("20 Aug 2026");
    expect(html).toContain("Service fee (15% of profit)");
    expect(html).toContain(INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO);
    expect(html).toContain(INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE);
    expect(html).toContain("10,000.00");
    expect(html).toContain("10,637.50");
    expect(html).toContain("Total credited to wallet");
    expect(html).toContain("Processing notice:");
    expect(html).not.toContain("CS-AR-2026-018");
    expect(html).not.toContain("ISS-2048");
    expect(html).not.toContain("Download confirmation");
    expect(html).not.toContain("View wallet");
    expect(html).not.toContain("Your investment note has been fully settled.");
    expect(html).not.toContain("href=");
    expect(html.toLowerCase()).not.toContain("<button");
    expect(html).not.toContain("<span>Ta’widh compensation</span>");
  });

  it("includes Ta’widh when the frozen snapshot says to show it", () => {
    const html = buildInvestmentSettlementConfirmationHtml(
      snapshot({
        tawidhCompensation: 25,
        showTawidh: true,
        totalCreditedToWallet: 10662.5,
      })
    );
    expect(html).toContain("<span>Ta’widh compensation</span>");
    expect(html).toContain("25.00");
  });
});
