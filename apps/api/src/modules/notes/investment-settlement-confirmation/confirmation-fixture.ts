import {
  INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
} from "@cashsouk/types";
import type { InvestmentSettlementConfirmationSnapshot } from "./types";

/** Frozen snapshot for DEV preview and renderer tests. Not used in production generation. */
export function sampleInvestmentSettlementConfirmationSnapshot(
  overrides: Partial<InvestmentSettlementConfirmationSnapshot> = {}
): InvestmentSettlementConfirmationSnapshot {
  return {
    templateId: "investment-settlement-confirmation-investor-v1",
    templateVersion: "V01",
    snapshotGeneratedAt: "2026-09-02T00:00:00.000Z",
    snapshotSha256: "snap-hash",
    source: "SETTLEMENT_POSTED",
    version: "V01",
    noteId: "note-1",
    noteReference: "ARF-202608-A52",
    settlementId: "set-1",
    settlementReference: "SET-ARF-202608-A52",
    investorOrganizationId: "org-a",
    investorReference: "IVT-A",
    investmentIds: ["inv-1"],
    issuerReference: "ISS-1",
    settlementDate: "2026-08-20T00:00:00.000Z",
    settlementDateDisplay: "20 August 2026",
    settlementDateSource: "ACTUAL_SETTLEMENT_DATE",
    principalReturned: 10000,
    grossProfitEarned: 1000,
    serviceFeeRatePercent: 15,
    serviceFeeLabel: "Service fee (15% of profit)",
    serviceFeeAmount: 150,
    netProfitCredited: 850,
    tawidhCompensation: 0,
    showTawidh: false,
    totalCreditedToWallet: 10850,
    walletTransactionIds: ["tx-1"],
    statusLabel: "Settled",
    introCopy: INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
    processingNotice: INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
    ...overrides,
  };
}
