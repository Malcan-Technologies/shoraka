export const SETTLEMENT_HIBAH_RECEIPT_VERSION_V01 = "V01";

export const SETTLEMENT_HIBAH_RECEIPT_TEMPLATE_ID = "settlement-hibah-receipt-issuer-v1";

export type SettlementHibahReceiptStatus = "PENDING" | "READY" | "FAILED";

export type SettlementHibahReceiptGenerationSource =
  | "SETTLEMENT_COMPLETED"
  | "ADMIN_RETRY"
  | "ADMIN_REISSUE";

export type SettlementHibahReceiptPdfPayload = {
  receiptNumber: string;
  version: string;
  status: SettlementHibahReceiptStatus | "NONE";
  generationError: string | null;
  generatedAt: string | null;
  canRetry: boolean;
  canReissue: boolean;
  viewUrl: string | null;
  downloadUrl: string | null;
  pdfExpiresIn: number | null;
  pdfContentType: "application/pdf";
  pdfFileName: string | null;
  pdfSha256: string | null;
};
