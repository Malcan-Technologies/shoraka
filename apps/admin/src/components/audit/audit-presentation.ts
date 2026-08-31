import { format } from "date-fns";
import { formatForensicAuditSourceLabel, formatRoleSwitchedLabel } from "@cashsouk/types";
import { humanizeAdminTimelineToken } from "@/components/admin-timeline-format";

export { formatRoleSwitchedLabel };

/** Canonical Admin log datetime: `26 Aug 2026, 8:45 PM`. */
export const AUDIT_DATETIME_FORMAT = "d MMM yyyy, h:mm a";
export const AUDIT_DATE_FORMAT = "d MMM yyyy";

export function formatAuditDateTime(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, AUDIT_DATETIME_FORMAT);
}

export function formatAuditDate(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, AUDIT_DATE_FORMAT);
}

/** Same Product Audit name source as API CSV/JSON: workflow[0].config.name, then type.name. */
export function productNameFromLogMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  const workflow = Array.isArray(metadata?.workflow) ? metadata.workflow : [];
  const first = workflow[0] as
    | { config?: { name?: unknown; type?: { name?: unknown } } }
    | undefined;
  const fromConfig = readProductWorkflowName(first?.config?.name);
  if (fromConfig) return fromConfig;
  return readProductWorkflowName(first?.config?.type?.name);
}

function readProductWorkflowName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const LEGAL_DOCUMENT_AUDIT_ACTION_LABELS: Record<string, string> = {
  LEGAL_DOCUMENT_CREATED: "Document Created",
  LEGAL_DOCUMENT_UPDATED: "Document Updated",
  LEGAL_VERSION_UPLOADED: "Version Uploaded",
  LEGAL_VERSION_FILE_REPLACED: "Version File Replaced",
  LEGAL_VERSION_PUBLISHED: "Version Published",
  LEGAL_VERSION_ARCHIVED: "Version Archived",
  LEGAL_VERSION_RESTORED: "Version Restored",
};

const APPLICATION_AUDIT_EVENT_LABELS: Record<string, string> = {
  AMENDMENTS_SUBMITTED: "Amendment Request Sent",
  MEMBER_ADDED: "Member Added",
  MEMBER_INVITED: "Member Invited",
  MEMBER_REMOVED: "Member Removed",
  MEMBER_ROLE_CHANGED: "Member Role Changed",
  MARC_ASSESSMENT_SAVED: "MARC Assessment Saved",
  ONBOARDING_APPROVED: "Onboarding Submission Approved",
  EOD_APPROVED: "Entity Onboarding Data Approved",
  EOD_REJECTED: "Entity Onboarding Data Rejected",
  EOD_WEBHOOK: "Entity Onboarding Data Provider Update",
  OVERDUE_LATE_CHARGE_CHECKED: "Note Entered Arrears",
  CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED: "Large Private Customer Flag Updated",
  GATEWAY_PAYMENT_COMPLETED: "Payment Received Successfully",
};

export function formatAuditEventLabel(
  eventType: string,
  overrides?: Record<string, string>
): string {
  const trimmed = eventType.trim();
  if (!trimmed) return "";
  if (overrides?.[trimmed]) return overrides[trimmed];
  if (LEGAL_DOCUMENT_AUDIT_ACTION_LABELS[trimmed]) return LEGAL_DOCUMENT_AUDIT_ACTION_LABELS[trimmed];
  if (APPLICATION_AUDIT_EVENT_LABELS[trimmed]) return APPLICATION_AUDIT_EVENT_LABELS[trimmed];
  return humanizeAdminTimelineToken(trimmed);
}

const SYSTEM_ACTOR_RE = /^(sys|system|system job|automated|auto)$/i;

export function isSystemActorToken(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 && SYSTEM_ACTOR_RE.test(trimmed);
}

const SECRET_KEY =
  /^(.*[_-]?)?(password|secret|access_?token|refresh_?token|id_token|private_?key|api_?key|authorization|credential|session_token)([_-].*)?$/i;

export function isAuditSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

export function redactAuditSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditSecrets);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isAuditSecretKey(key) ? "[REDACTED]" : redactAuditSecrets(nested);
    }
    return out;
  }
  return value;
}

export function stringifyAuditMetadata(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(redactAuditSecrets(value), null, 2);
  } catch {
    return String(value);
  }
}

export function compactAuditMetadata(value: unknown): string {
  if (value == null) return "";
  try {
    const redacted = redactAuditSecrets(value);
    if (typeof redacted === "string") return redacted;
    return JSON.stringify(redacted);
  } catch {
    return String(value);
  }
}

export function formatAuditScalar(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return formatAuditDateTime(date);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);
      return format(new Date(year, month - 1, day), AUDIT_DATE_FORMAT);
    }
    return value;
  }
  return compactAuditMetadata(value);
}

const MARC_ASSESSMENT_AUDIT_FIELD_LABELS: Record<string, string> = {
  creditGrade: "Credit Grade",
  creditScore: "Credit Score",
  probabilityOfDefault: "Probability of Default",
  reportFileName: "Report",
  reportDate: "Report Date",
};

function formatMarcAssessmentAuditField(field: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "probabilityOfDefault") {
    const n = Number(value);
    if (Number.isFinite(n)) return `${n.toFixed(2)}%`;
    const text = String(value).trim();
    return text.endsWith("%") ? text : `${text}%`;
  }
  if (field === "reportDate") {
    return formatAuditScalar(String(value)) || String(value);
  }
  return formatAuditScalar(value) || "—";
}

/** Business-friendly previous/next display for MARC_ASSESSMENT_SAVED Event Details. */
export function presentMarcAssessmentAuditValues(value: unknown): Record<string, string> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [field, label] of Object.entries(MARC_ASSESSMENT_AUDIT_FIELD_LABELS)) {
    if (!(field in record)) continue;
    out[label] = formatMarcAssessmentAuditField(field, record[field]);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export type AuditChangedField = { field: string; before: string; after: string };

function flattenRecord(value: unknown, prefix = ""): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: value } : {};
  }
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (isAuditSecretKey(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      Object.assign(out, flattenRecord(nested, path));
    } else {
      out[path] = nested;
    }
  }
  return out;
}

export function diffAuditValues(previous: unknown, next: unknown): AuditChangedField[] {
  const before = flattenRecord(previous);
  const after = flattenRecord(next);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const rows: AuditChangedField[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null)) continue;
    rows.push({
      field: key,
      before: before[key] == null ? "—" : formatAuditScalar(before[key]) || "—",
      after: after[key] == null ? "—" : formatAuditScalar(after[key]) || "—",
    });
  }
  return rows;
}

export function extractPreviousNext(metadata: Record<string, unknown> | null | undefined): {
  previous: unknown;
  next: unknown;
} {
  if (!metadata) return { previous: undefined, next: undefined };
  return {
    previous:
      metadata.previousValues ??
      metadata.previous_values ??
      metadata.beforeJson ??
      metadata.before ??
      metadata.beforeState,
    next:
      metadata.nextValues ??
      metadata.next_values ??
      metadata.afterJson ??
      metadata.after ??
      metadata.afterState,
  };
}

export type AuditActorKind = "ADMIN" | "SYSTEM" | "INVESTOR" | "ISSUER" | "USER";

export function resolveAuditActorType(input: {
  actorType?: string | null;
  portal?: string | null;
  actorName?: string | null;
  actorUserId?: string | null;
}): AuditActorKind {
  const type = input.actorType?.trim().toUpperCase();
  if (type === "ADMIN" || type === "SYSTEM" || type === "INVESTOR" || type === "ISSUER" || type === "USER") {
    return type;
  }
  if (isSystemActorToken(input.actorName) || isSystemActorToken(input.actorType) || !input.actorUserId?.trim()) {
    if (!input.actorUserId?.trim() || isSystemActorToken(input.actorName) || isSystemActorToken(input.actorType)) {
      if (!input.actorUserId?.trim() || isSystemActorToken(input.actorName)) return "SYSTEM";
    }
  }
  const portal = input.portal?.trim().toUpperCase();
  if (portal === "ADMIN") return "ADMIN";
  if (portal === "INVESTOR") return "INVESTOR";
  if (portal === "ISSUER") return "ISSUER";
  if (input.actorUserId?.trim()) return "USER";
  return "SYSTEM";
}

export function formatAuditActorTypeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case "ADMIN":
      return "Admin";
    case "SYSTEM":
      return "System";
    case "INVESTOR":
      return "Investor";
    case "ISSUER":
      return "Issuer";
    case "USER":
      return "User";
    default:
      return formatAuditEventLabel(type);
  }
}

export function formatAuditSourceLabel(source: string | null | undefined): string {
  if (!source?.trim()) return "";
  const key = source.trim().toUpperCase();
  if (key === "ADMIN") return "Admin Portal";
  if (key === "SYSTEM") return "System";
  if (
    key === "API" ||
    key === "PORTAL" ||
    key === "WEBHOOK" ||
    key === "SYSTEM_JOB" ||
    key === "JOB" ||
    key === "INTERNAL"
  ) {
    return formatForensicAuditSourceLabel(source);
  }
  return formatAuditEventLabel(source);
}

export function presentAuditActorName(name: string | null | undefined, actorType?: string | null): string {
  if (isSystemActorToken(name) || (!name?.trim() && (actorType?.toUpperCase() === "SYSTEM" || isSystemActorToken(actorType)))) {
    return "System";
  }
  const trimmed = name?.trim() ?? "";
  return trimmed || "System";
}
