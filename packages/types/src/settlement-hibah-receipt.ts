export const SETTLEMENT_HIBAH_RECEIPT_VERSION_V01 = "V01";

export const SETTLEMENT_HIBAH_RECEIPT_TEMPLATE_ID = "settlement-hibah-receipt-issuer-v1";

export type SettlementHibahReceiptStatus = "PENDING" | "READY" | "FAILED";

export type SettlementHibahReceiptGenerationSource =
  | "SETTLEMENT_COMPLETED"
  | "ADMIN_GENERATE"
  | "ADMIN_RETRY"
  | "ADMIN_REISSUE";

export type SettlementHibahReceiptPdfPayload = {
  receiptNumber: string;
  version: string;
  status: SettlementHibahReceiptStatus | "NONE";
  isCurrent: boolean;
  generationError: string | null;
  generatedAt: string | null;
  canGenerate: boolean;
  canRetry: boolean;
  canRegenerate: boolean;
  canPublish: boolean;
  viewUrl: string | null;
  downloadUrl: string | null;
  pdfExpiresIn: number | null;
  pdfContentType: "application/pdf";
  pdfFileName: string | null;
  pdfSha256: string | null;
  reviewVersion: import("./official-document-version").OfficialDocumentReviewVersion | null;
};
