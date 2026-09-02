export const INVESTMENT_SETTLEMENT_CONFIRMATION_VERSION_V01 = "V01";

export const INVESTMENT_SETTLEMENT_CONFIRMATION_TEMPLATE_ID =
  "investment-settlement-confirmation-investor-v1";

export const INVESTMENT_SETTLEMENT_CONFIRMATION_INTRO =
  "This investment has been settled. Your principal and net profit, after deduction of the applicable service fee, together with any Ta’widh compensation where applicable, have been credited to your CashSouk wallet.";

export const INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE =
  "The credited amount may take 2–3 working days to be reflected in your available wallet balance.";

export const INVESTMENT_SETTLEMENT_CONFIRMATION_STATUS_LABEL = "Settled";

export type InvestmentSettlementConfirmationStatus = "PENDING" | "READY" | "FAILED";

export type InvestmentSettlementConfirmationGenerationSource =
  | "SETTLEMENT_POSTED"
  | "ADMIN_RETRY";

export type InvestmentSettlementConfirmationDateSource =
  | "ACTUAL_SETTLEMENT_DATE"
  | "POSTED_AT"
  | "REPAID_AT";

export type InvestmentSettlementConfirmationDisplay = {
  version: string;
  statusLabel: string;
  introCopy: string;
  processingNotice: string;
  noteReference: string;
  issuerReference: string;
  settlementDateDisplay: string;
  principalReturned: number;
  grossProfitEarned: number;
  serviceFeeRatePercent: number;
  serviceFeeLabel: string;
  serviceFeeAmount: number;
  netProfitCredited: number;
  tawidhCompensation: number;
  showTawidh: boolean;
  totalCreditedToWallet: number;
};

export type InvestmentSettlementConfirmationPdfPayload = InvestmentSettlementConfirmationDisplay & {
  status: InvestmentSettlementConfirmationStatus | "NONE";
  generationError: string | null;
  generatedAt: string | null;
  canRetry: boolean;
  viewUrl: string | null;
  downloadUrl: string | null;
  pdfExpiresIn: number | null;
  pdfContentType: "application/pdf";
  pdfFileName: string | null;
  pdfSha256: string | null;
};

export type AdminInvestmentSettlementConfirmationItem = {
  investorOrganizationId: string;
  investorReference: string;
  status: InvestmentSettlementConfirmationStatus;
  generationError: string | null;
  generatedAt: string | null;
  canRetry: boolean;
  viewUrl: string | null;
  downloadUrl: string | null;
  pdfExpiresIn: number | null;
  pdfContentType: "application/pdf";
  pdfFileName: string | null;
  pdfSha256: string | null;
  totalCreditedToWallet: number;
};

export type AdminInvestmentSettlementConfirmationsPayload = {
  settlementId: string | null;
  settlementReference: string | null;
  version: string;
  expectedCount: number;
  readyCount: number;
  pendingCount: number;
  failedCount: number;
  confirmations: AdminInvestmentSettlementConfirmationItem[];
};
