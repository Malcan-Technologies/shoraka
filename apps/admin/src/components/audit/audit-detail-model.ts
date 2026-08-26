import type { AuditActorKind, AuditChangedField } from "./audit-presentation";

export type AuditDetailField = {
  label: string;
  value: string;
};

export type AuditDetailRecord = {
  id: string;
  title: string;
  eventLabel: string;
  eventType: string;
  timestamp: string;
  status?: string | null;
  description?: string | null;
  actor?: {
    name?: string | null;
    email?: string | null;
    type?: AuditActorKind | string | null;
    organisation?: string | null;
    source?: string | null;
    id?: string | null;
    portal?: string | null;
  };
  target?: {
    type?: string | null;
    id?: string | null;
    applicationReference?: string | null;
    noteReference?: string | null;
    investmentReference?: string | null;
    withdrawalReference?: string | null;
    paymentReference?: string | null;
    gatewayReference?: string | null;
    trusteeInstructionReference?: string | null;
    envelopeReference?: string | null;
    extra?: AuditDetailField[];
  };
  financial?: {
    amount?: string | null;
    currency?: string | null;
    previousAmount?: string | null;
    newAmount?: string | null;
    paymentStatus?: string | null;
    settlementStatus?: string | null;
    extra?: AuditDetailField[];
  };
  changedFields?: AuditChangedField[];
  reason?: string | null;
  remark?: string | null;
  delivery?: {
    notificationType?: string | null;
    audience?: string | null;
    source?: string | null;
    platformDelivered?: string | null;
    emailDelivered?: string | null;
    idempotencyKey?: string | null;
    title?: string | null;
    message?: string | null;
  };
  technical?: AuditDetailField[];
  metadata?: unknown;
  previousValues?: unknown;
  nextValues?: unknown;
};

export function presentFields(
  fields: Array<{ label: string; value?: string | number | null }>
): AuditDetailField[] {
  return fields
    .map((field) => ({
      label: field.label,
      value: field.value == null ? "" : String(field.value).trim(),
    }))
    .filter((field) => field.value.length > 0);
}
