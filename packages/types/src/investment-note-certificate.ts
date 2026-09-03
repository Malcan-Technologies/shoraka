export const INVESTMENT_NOTE_CERTIFICATE_VERSION_V01 = "V01";

export const INVESTMENT_NOTE_CERTIFICATE_TEMPLATE_ID =
  "islamic-investment-note-certificate-v1";

export type InvestmentNoteCertificateAudience = "ADMIN" | "ISSUER" | "INVESTOR";

export type InvestmentNoteCertificateStatus = "PENDING" | "READY" | "FAILED";

export type InvestmentNoteCertificateGenerationSource =
  | "DISBURSEMENT_COMPLETED"
  | "ADMIN_GENERATE"
  | "ADMIN_RETRY"
  | "ADMIN_REISSUE";

export type InvestmentNoteCertificatePdfPayload = {
  certificateNumber: string;
  version: string;
  status: InvestmentNoteCertificateStatus | "NONE";
  isCurrent: boolean;
  generationError: string | null;
  generatedAt: string | null;
  investorCount: number;
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
