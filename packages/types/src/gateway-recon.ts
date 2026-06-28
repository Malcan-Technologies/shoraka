export type GatewayReconRunStatus = "RUNNING" | "COMPLETED" | "FAILED";

export type GatewayReconExceptionType = "ORPHAN_CURLEC_PAYMENT" | "AMOUNT_MISMATCH";

export interface GatewayReconRunDto {
  id: string;
  runDate: string;
  status: GatewayReconRunStatus;
  triggeredBy: string;
  settlementsScanned: number;
  paymentsMatched: number;
  paymentsStamped: number;
  exceptionsCount: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface GatewayReconExceptionDto {
  id: string;
  reconRunId: string;
  type: GatewayReconExceptionType;
  gatewayPaymentId: string | null;
  curlecPaymentId: string | null;
  curlecSettlementId: string | null;
  expectedAmount: number | null;
  actualAmount: number | null;
  detail: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolveReason: string | null;
  createdAt: string;
}

export interface GatewayReconRunDetailDto extends GatewayReconRunDto {
  exceptions: GatewayReconExceptionDto[];
}

export interface GatewayReconRunListResponse {
  items: GatewayReconRunDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GatewayReconExceptionListResponse {
  items: GatewayReconExceptionDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GatewayReconPendingCountResponse {
  count: number;
}
