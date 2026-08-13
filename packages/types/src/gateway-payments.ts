import type { GatewayPaymentStatus, NameCheckResult } from "./notes";
import type { PaymentAuditLogDto } from "./payment-audit";

export type GatewayPaymentPurpose =
  | "INVESTOR_DEPOSIT"
  | "ISSUER_ONBOARDING_FEE"
  | "APPLICATION_PROCESSING_FEE";

export type GatewayOrganizationType = "INVESTOR" | "ISSUER";
export type CurlecGatewayAccount = "OPERATING" | "INVESTOR_POOL";

export interface GatewayPaymentListItemDto {
  id: string;
  gatewayAccount: CurlecGatewayAccount;
  purpose: GatewayPaymentPurpose;
  organizationType: GatewayOrganizationType;
  status: GatewayPaymentStatus;
  amount: number;
  currency: string;
  payerName: string | null;
  nameCheckResult: NameCheckResult | null;
  investorOrganizationId: string | null;
  investorOrganizationName: string | null;
  issuerOrganizationId: string | null;
  issuerOrganizationName: string | null;
  curlecOrderId: string;
  curlecPaymentId: string | null;
  settlementId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayPaymentDetailDto extends GatewayPaymentListItemDto {
  method: string | null;
  bankCode: string | null;
  expectedPayerName: string | null;
  nameCheckAt: string | null;
  nameCheckedByUserId: string | null;
  refundReference: string | null;
  refundInitiatedBy: string | null;
  refundedAt: string | null;
  refundNotes: string | null;
  openOverrideProposedBy: string | null;
  openOverrideReason: string | null;
  metadata: Record<string, unknown> | null;
  events: PaymentAuditLogDto[];
  receipt: GatewayPaymentReceiptSummaryDto | null;
}

export type GatewayPaymentReceiptStatus =
  | "PENDING"
  | "GENERATED"
  | "FAILED"
  | "REFUNDED";

export interface GatewayPaymentReceiptSummaryDto {
  id: string;
  receiptNumber: string;
  purposeLabel: string;
  status: GatewayPaymentReceiptStatus;
  hasPdf: boolean;
  paymentDate: string;
  relatedReference: string | null;
  relatedReferenceLabel?: string | null;
  amount: number;
  currency: string;
  payerName: string | null;
  payerCompanyName: string | null;
  curlecPaymentId: string | null;
  curlecOrderId: string | null;
}

export interface GatewayPaymentReceiptDto extends GatewayPaymentReceiptSummaryDto {
  gatewayPaymentId: string;
  paymentPurpose: GatewayPaymentPurpose;
  payerEmail: string | null;
  payerPhone: string | null;
  paymentMethod: string | null;
  relatedEntityType: string;
  relatedEntityId: string;
  walletCredited: boolean;
  generationError: string | null;
  generatedAt: string | null;
  refundReference: string | null;
  refundAmount: number | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayPaymentReceiptListResponse {
  items: GatewayPaymentReceiptDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GatewayPaymentReceiptPdfUrlResponse {
  url: string;
  expiresIn: number;
  fileName: string;
  mode: "view" | "download";
}

export interface GatewayPaymentListResponse {
  items: GatewayPaymentListItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GatewayPaymentPendingCountResponse {
  count: number;
}
