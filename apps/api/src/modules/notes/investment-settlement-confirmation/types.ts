import {
  INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO,
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE,
  INVESTMENT_SETTLEMENT_CONFIRMATION_STATUS_LABEL,
  INVESTMENT_SETTLEMENT_CONFIRMATION_TEMPLATE_ID,
  INVESTMENT_SETTLEMENT_CONFIRMATION_VERSION_V01,
  type InvestmentSettlementConfirmationDateSource,
  type InvestmentSettlementConfirmationGenerationSource,
} from "@cashsouk/types";

export const CONFIRMATION_TEMPLATE_ID = INVESTMENT_SETTLEMENT_CONFIRMATION_TEMPLATE_ID;
export const CONFIRMATION_FIRST_VERSION = INVESTMENT_SETTLEMENT_CONFIRMATION_VERSION_V01;
export const CONFIRMATION_INTRO = INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO;
export const CONFIRMATION_PROCESSING_NOTICE =
  INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE;
export const CONFIRMATION_STATUS_LABEL = INVESTMENT_SETTLEMENT_CONFIRMATION_STATUS_LABEL;

export type ConfirmationGenerationSource = InvestmentSettlementConfirmationGenerationSource;
export type ConfirmationDateSource = InvestmentSettlementConfirmationDateSource;

export type InvestmentSettlementConfirmationSnapshot = {
  templateId: string;
  templateVersion: string;
  snapshotGeneratedAt: string;
  snapshotSha256: string;
  source: ConfirmationGenerationSource;
  version: string;
  noteId: string;
  noteReference: string;
  settlementId: string;
  settlementReference: string;
  investorOrganizationId: string;
  investorReference: string;
  investmentIds: string[];
  issuerReference: string;
  settlementDate: string;
  settlementDateDisplay: string;
  settlementDateSource: ConfirmationDateSource;
  principalReturned: number;
  grossProfitEarned: number;
  serviceFeeRatePercent: number;
  serviceFeeLabel: string;
  serviceFeeAmount: number;
  netProfitCredited: number;
  tawidhCompensation: number;
  showTawidh: boolean;
  totalCreditedToWallet: number;
  walletTransactionIds: string[];
  statusLabel: typeof CONFIRMATION_STATUS_LABEL;
  introCopy: typeof CONFIRMATION_INTRO;
  processingNotice: typeof CONFIRMATION_PROCESSING_NOTICE;
};

export class ConfirmationGenerationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INCOMPLETE_DATA"
      | "NOT_ELIGIBLE"
      | "RECONCILIATION_FAILED"
      | "PLAYWRIGHT_FAILED"
      | "S3_FAILED"
  ) {
    super(message);
    this.name = "ConfirmationGenerationError";
  }
}

export type SettlementAllocationRow = {
  investmentId: string;
  investorOrganizationId: string;
  principal: number;
  profitNet: number;
  tawidhInvestorShare: number;
};
