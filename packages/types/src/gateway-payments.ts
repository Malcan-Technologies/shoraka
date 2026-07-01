import type { GatewayPaymentStatus, NameCheckResult } from "./notes";

export type GatewayPaymentPurpose =
  | "INVESTOR_DEPOSIT"
  | "ISSUER_ONBOARDING_FEE"
  | "APPLICATION_PROCESSING_FEE";

export type GatewayOrganizationType = "INVESTOR" | "ISSUER";

export type GatewayPaymentEventType =
  | "NAME_CHECK"
  | "NAME_CHECK_APPROVED"
  | "NAME_CHECK_REJECTED"
  | "OVERRIDE_PROPOSED"
  | "OVERRIDE_APPROVED"
  | "OVERRIDE_REJECTED"
  | "REFUND_INITIATED"
  | "REFUNDED"
  | "EXPIRED";

export interface GatewayPaymentEventDto {
  id: string;
  type: GatewayPaymentEventType;
  actorUserId: string | null;
  fromStatus: GatewayPaymentStatus | null;
  toStatus: GatewayPaymentStatus | null;
  reason: string | null;
  createdAt: string;
}

export interface GatewayPaymentListItemDto {
  id: string;
  purpose: GatewayPaymentPurpose;
  organizationType: GatewayOrganizationType;
  status: GatewayPaymentStatus;
  amount: number;
  currency: string;
  payerName: string | null;
  nameCheckResult: NameCheckResult | null;
  investorOrganizationId: string | null;
  investorOrganizationName: string | null;
  curlecOrderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GatewayPaymentDetailDto extends GatewayPaymentListItemDto {
  curlecPaymentId: string | null;
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
  events: GatewayPaymentEventDto[];
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
