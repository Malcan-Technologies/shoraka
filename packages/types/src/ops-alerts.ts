export type OpsAlertType =
  | "STUCK_PAYMENT"
  | "RECON_MISMATCH"
  | "RECEIPT_FAILURE"
  | "WEBHOOK_FAILURE"
  | "SIGNING_EXPIRY"
  | "PROVIDER_FAILURE"
  | "REPEATED_JOB_FAILURE"
  | "MISSING_LEGAL_EVIDENCE"
  | "GATEWAY_LEDGER_MISMATCH";

export type OpsAlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type OpsAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "CLOSED";

export interface OpsAlertListItem {
  id: string;
  type: OpsAlertType;
  severity: OpsAlertSeverity;
  status: OpsAlertStatus;
  dedupeKey: string;
  title: string;
  summary: string | null;
  entityType: string | null;
  entityId: string | null;
  details: unknown;
  ownerUserId: string | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedByUserId: string | null;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
}

export const OPS_ALERT_TYPE_LABELS: Record<OpsAlertType, string> = {
  STUCK_PAYMENT: "Stuck payment",
  RECON_MISMATCH: "Recon mismatch",
  RECEIPT_FAILURE: "Receipt failure",
  WEBHOOK_FAILURE: "Webhook failure",
  SIGNING_EXPIRY: "Signing expiry",
  PROVIDER_FAILURE: "Provider failure",
  REPEATED_JOB_FAILURE: "Repeated job failure",
  MISSING_LEGAL_EVIDENCE: "Missing legal evidence",
  GATEWAY_LEDGER_MISMATCH: "Gateway/ledger mismatch",
};
