/**
 * Multi-party signing domain contracts shared across API + portals.
 *
 * Two layers live here:
 *  1. Template config (`SigningTemplateConfig`) — product-level definition of which
 *     documents exist, which signer roles exist, and who signs what. Stored inside
 *     `Product.workflow` (see `SIGNING_TEMPLATE_WORKFLOW_KEY`) and configured by admins.
 *  2. Runtime DTOs (`SigningEnvelopeDto` and friends) — the per-application envelope the
 *     API returns to admin / issuer / external signer UIs. These mirror the Prisma
 *     `signing_*` models.
 *
 * String unions here must stay in sync with the Prisma enums in apps/api/prisma/schema.prisma.
 */

export type SigningEnvelopeStatus =
  | "DRAFT"
  | "SENT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "VOIDED"
  | "EXPIRED";

export type SigningRoutingMode = "SEQUENTIAL" | "PARALLEL";

export type SigningDocumentSource =
  | "GENERATED_OFFER_LETTER"
  | "ADMIN_UPLOAD"
  | "ISSUER_UPLOAD"
  | "TEMPLATE";

export type SigningDocumentStatus =
  | "DRAFT"
  | "PENDING"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "VOIDED";

export type SigningPartyType = "INTERNAL" | "EXTERNAL";

export type SigningRecipientStatus = "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED";

export type SigningKycStatus = "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "FAILED";

export type SigningAction = "SIGN" | "UPLOAD" | "VIEW";

export type SigningAssignmentStatus = "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED";

export type SigningDocumentFileType = "pdf" | "excel";

/**
 * Hint for the admin binding UI: where a role's real person is usually sourced from.
 * "custom" = admin types the person in manually.
 */
export type SigningRoleSourceHint = "issuer_director" | "guarantor" | "platform" | "custom";

// ---------------------------------------------------------------------------
// Template config (product-level)
// ---------------------------------------------------------------------------

/** Key under which the signing template is stored inside Product.workflow config. */
export const SIGNING_TEMPLATE_WORKFLOW_KEY = "signing_template";

export interface SigningTemplateRole {
  /** Stable machine key, e.g. "borrower_director". */
  key: string;
  /** Human label, e.g. "Borrower Director". */
  label: string;
  party_type: SigningPartyType;
  source_hint: SigningRoleSourceHint;
  /** Lower runs first when routing_mode is SEQUENTIAL. */
  routing_order: number;
  kyc_required: boolean;
  /** Minimum number of people that must be bound to this role at send time. */
  min_count: number;
  /** Maximum number of people (null = unbounded, e.g. multiple guarantors). */
  max_count: number | null;
}

export interface SigningTemplateDocument {
  /** Stable machine key within the template. */
  key: string;
  name: string;
  description?: string;
  source: SigningDocumentSource;
  required: boolean;
  /** Display / signing order within the envelope. */
  order: number;
  /** Allowed file types when the document is uploaded (not for generated docs). */
  allowed_types?: SigningDocumentFileType[];
  /** Optional admin-provided template file the signer starts from. */
  template?: { s3_key: string; file_name: string; file_size?: number };
  /** Role keys whose bound people must sign this document. */
  signer_role_keys: string[];
}

export interface SigningTemplateConfig {
  enabled: boolean;
  routing_mode: SigningRoutingMode;
  roles: SigningTemplateRole[];
  documents: SigningTemplateDocument[];
}

export const DEFAULT_SIGNING_TEMPLATE_CONFIG: SigningTemplateConfig = {
  enabled: false,
  routing_mode: "PARALLEL",
  roles: [],
  documents: [],
};

const DOCUMENT_SOURCES: readonly SigningDocumentSource[] = [
  "GENERATED_OFFER_LETTER",
  "ADMIN_UPLOAD",
  "ISSUER_UPLOAD",
  "TEMPLATE",
];

const PARTY_TYPES: readonly SigningPartyType[] = ["INTERNAL", "EXTERNAL"];

const ROLE_SOURCE_HINTS: readonly SigningRoleSourceHint[] = [
  "issuer_director",
  "guarantor",
  "platform",
  "custom",
];

const FILE_TYPES: readonly SigningDocumentFileType[] = ["pdf", "excel"];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value.trim(), 10);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

function parseTemplateRole(raw: unknown, index: number): SigningTemplateRole {
  const r = asRecord(raw);
  const party_type = PARTY_TYPES.includes(r.party_type as SigningPartyType)
    ? (r.party_type as SigningPartyType)
    : "INTERNAL";
  const source_hint = ROLE_SOURCE_HINTS.includes(r.source_hint as SigningRoleSourceHint)
    ? (r.source_hint as SigningRoleSourceHint)
    : "custom";
  return {
    key: asString(r.key).trim() || `role_${index + 1}`,
    label: asString(r.label).trim(),
    party_type,
    source_hint,
    routing_order: asInt(r.routing_order, index),
    kyc_required: r.kyc_required !== false, // default true; KYC is required unless explicitly disabled
    min_count: Math.max(0, asInt(r.min_count, 1)),
    max_count:
      r.max_count === null || r.max_count === undefined ? null : Math.max(1, asInt(r.max_count, 1)),
  };
}

function parseTemplateDocument(raw: unknown, index: number): SigningTemplateDocument {
  const r = asRecord(raw);
  const source = DOCUMENT_SOURCES.includes(r.source as SigningDocumentSource)
    ? (r.source as SigningDocumentSource)
    : "TEMPLATE";
  const allowedTypesRaw = Array.isArray(r.allowed_types) ? r.allowed_types : undefined;
  const allowed_types = allowedTypesRaw
    ?.filter((t): t is SigningDocumentFileType => FILE_TYPES.includes(t as SigningDocumentFileType))
    .filter((t, i, arr) => arr.indexOf(t) === i);
  const templateRaw = asRecord(r.template);
  const templateS3 = asString(templateRaw.s3_key).trim();
  const signerRoleKeys = Array.isArray(r.signer_role_keys)
    ? r.signer_role_keys.filter((k): k is string => typeof k === "string" && k.trim() !== "")
    : [];
  return {
    key: asString(r.key).trim() || `document_${index + 1}`,
    name: asString(r.name).trim(),
    description: asString(r.description).trim() || undefined,
    source,
    required: r.required !== false,
    order: asInt(r.order, index),
    allowed_types: allowed_types && allowed_types.length > 0 ? allowed_types : undefined,
    template: templateS3
      ? {
          s3_key: templateS3,
          file_name: asString(templateRaw.file_name) || "template.pdf",
          ...(typeof templateRaw.file_size === "number"
            ? { file_size: templateRaw.file_size }
            : {}),
        }
      : undefined,
    signer_role_keys: signerRoleKeys,
  };
}

/** Tolerant parse of the template config from arbitrary JSON (never throws). */
export function parseSigningTemplateConfig(raw: unknown): SigningTemplateConfig {
  if (raw == null) return { ...DEFAULT_SIGNING_TEMPLATE_CONFIG };
  const r = asRecord(raw);
  const roles = Array.isArray(r.roles) ? r.roles.map(parseTemplateRole) : [];
  const documents = Array.isArray(r.documents) ? r.documents.map(parseTemplateDocument) : [];
  return {
    enabled: r.enabled === true,
    routing_mode: r.routing_mode === "SEQUENTIAL" ? "SEQUENTIAL" : "PARALLEL",
    roles,
    documents: [...documents].sort((a, b) => a.order - b.order),
  };
}

/**
 * Return validation error messages for a signing template. Empty array = valid.
 * Only enforced when `enabled` is true.
 */
export function validateSigningTemplateConfig(config: SigningTemplateConfig): string[] {
  const errors: string[] = [];
  if (!config.enabled) return errors;

  if (config.roles.length === 0) errors.push("Signing: add at least one signer role.");
  if (config.documents.length === 0) errors.push("Signing: add at least one document.");

  const roleKeys = new Set<string>();
  for (const role of config.roles) {
    if (!role.label.trim()) errors.push("Signing: every signer role needs a label.");
    if (roleKeys.has(role.key)) errors.push(`Signing: duplicate role key "${role.key}".`);
    roleKeys.add(role.key);
    if (role.max_count != null && role.max_count < role.min_count) {
      errors.push(`Signing: role "${role.label || role.key}" max count is below its min count.`);
    }
  }

  const docKeys = new Set<string>();
  for (const doc of config.documents) {
    if (!doc.name.trim()) errors.push("Signing: every document needs a name.");
    if (docKeys.has(doc.key)) errors.push(`Signing: duplicate document key "${doc.key}".`);
    docKeys.add(doc.key);
    if (doc.signer_role_keys.length === 0) {
      errors.push(`Signing: document "${doc.name || doc.key}" has no assigned signer role.`);
    }
    for (const roleKey of doc.signer_role_keys) {
      if (!roleKeys.has(roleKey)) {
        errors.push(
          `Signing: document "${doc.name || doc.key}" references unknown role "${roleKey}".`
        );
      }
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Envelope planning (template + bound people -> envelope graph spec)
//
// Pure, provider- and DB-agnostic. The API persists the returned plan and the
// provider adapter sends it. Kept here so the admin UI can preview the exact
// envelope before it is created.
// ---------------------------------------------------------------------------

/** A real person the admin binds to a template role at send time. */
export interface RecipientBinding {
  role_key: string;
  name: string;
  email: string;
  /** INTERNAL issuer user id (when the person has a platform account). */
  user_id?: string | null;
  /** application_guarantors.id when pre-filled from a guarantor. */
  application_guarantor_id?: string | null;
  ic_number?: string | null;
}

export interface PlannedRecipient {
  /** Temporary reference used to wire assignments before DB ids exist. */
  ref: string;
  role_key: string;
  role_label: string;
  party_type: SigningPartyType;
  name: string;
  email: string;
  user_id: string | null;
  application_guarantor_id: string | null;
  ic_number: string | null;
  routing_order: number;
  kyc_required: boolean;
}

export interface PlannedDocument {
  ref: string;
  key: string;
  name: string;
  description?: string;
  source: SigningDocumentSource;
  required: boolean;
  order: number;
  template?: { s3_key: string; file_name: string; file_size?: number };
}

export interface PlannedAssignment {
  document_ref: string;
  recipient_ref: string;
  required: boolean;
  action: SigningAction;
}

export interface EnvelopePlan {
  routing_mode: SigningRoutingMode;
  documents: PlannedDocument[];
  recipients: PlannedRecipient[];
  assignments: PlannedAssignment[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate that the admin's role bindings satisfy the template (counts, known roles,
 * required contact fields). Empty array = valid. Only meaningful when template.enabled.
 */
export function validateRecipientBindings(
  template: SigningTemplateConfig,
  bindings: RecipientBinding[]
): string[] {
  const errors: string[] = [];
  const byRole = new Map<string, RecipientBinding[]>();
  const roleByKey = new Map(template.roles.map((r) => [r.key, r]));

  for (const b of bindings) {
    if (!roleByKey.has(b.role_key)) {
      errors.push(`Binding references unknown role "${b.role_key}".`);
      continue;
    }
    if (!b.name.trim()) errors.push(`A ${b.role_key} recipient is missing a name.`);
    if (!EMAIL_RE.test(b.email.trim())) {
      errors.push(`A ${b.role_key} recipient has an invalid email.`);
    }
    const list = byRole.get(b.role_key) ?? [];
    list.push(b);
    byRole.set(b.role_key, list);
  }

  for (const role of template.roles) {
    const count = byRole.get(role.key)?.length ?? 0;
    if (count < role.min_count) {
      errors.push(
        `Role "${role.label || role.key}" needs at least ${role.min_count} recipient(s); got ${count}.`
      );
    }
    if (role.max_count != null && count > role.max_count) {
      errors.push(
        `Role "${role.label || role.key}" allows at most ${role.max_count} recipient(s); got ${count}.`
      );
    }
  }

  return errors;
}

/**
 * Build the envelope graph spec from a template and the admin's bindings.
 * Assumes bindings already passed `validateRecipientBindings`.
 */
export function buildEnvelopePlanFromTemplate(
  template: SigningTemplateConfig,
  bindings: RecipientBinding[]
): EnvelopePlan {
  const roleByKey = new Map(template.roles.map((r) => [r.key, r]));
  const perRoleIndex = new Map<string, number>();

  const recipients: PlannedRecipient[] = bindings
    .filter((b) => roleByKey.has(b.role_key))
    .map((b) => {
      const role = roleByKey.get(b.role_key)!;
      const idx = perRoleIndex.get(b.role_key) ?? 0;
      perRoleIndex.set(b.role_key, idx + 1);
      return {
        ref: `${b.role_key}#${idx}`,
        role_key: role.key,
        role_label: role.label,
        party_type: role.party_type,
        name: b.name.trim(),
        email: b.email.trim().toLowerCase(),
        user_id: b.user_id ?? null,
        application_guarantor_id: b.application_guarantor_id ?? null,
        ic_number: b.ic_number ?? null,
        routing_order: role.routing_order,
        kyc_required: role.kyc_required,
      };
    });

  const recipientsByRole = new Map<string, PlannedRecipient[]>();
  for (const r of recipients) {
    const list = recipientsByRole.get(r.role_key) ?? [];
    list.push(r);
    recipientsByRole.set(r.role_key, list);
  }

  const documents: PlannedDocument[] = [...template.documents]
    .sort((a, b) => a.order - b.order)
    .map((doc, index) => ({
      ref: doc.key,
      key: doc.key,
      name: doc.name,
      description: doc.description,
      source: doc.source,
      required: doc.required,
      order: index,
      template: doc.template,
    }));

  const assignments: PlannedAssignment[] = [];
  for (const doc of template.documents) {
    for (const roleKey of doc.signer_role_keys) {
      for (const recipient of recipientsByRole.get(roleKey) ?? []) {
        assignments.push({
          document_ref: doc.key,
          recipient_ref: recipient.ref,
          required: doc.required,
          action: "SIGN",
        });
      }
    }
  }

  return {
    routing_mode: template.routing_mode,
    documents,
    recipients,
    assignments,
  };
}

// ---------------------------------------------------------------------------
// Runtime DTOs (per-application envelope)
// ---------------------------------------------------------------------------

export interface SigningAssignmentDto {
  id: string;
  document_id: string;
  recipient_id: string;
  required: boolean;
  action: SigningAction;
  status: SigningAssignmentStatus;
  signed_at: string | null;
}

export interface SigningDocumentDto {
  id: string;
  name: string;
  description: string | null;
  source: SigningDocumentSource;
  order: number;
  required: boolean;
  status: SigningDocumentStatus;
  signed_s3_key: string | null;
}

export interface SigningRecipientDto {
  id: string;
  role_key: string;
  role_label: string;
  party_type: SigningPartyType;
  name: string;
  email: string;
  routing_order: number;
  status: SigningRecipientStatus;
  kyc_status: SigningKycStatus;
  completed_at: string | null;
}

export interface SigningEnvelopeDto {
  id: string;
  application_id: string;
  contract_id: string | null;
  invoice_id: string | null;
  title: string;
  status: SigningEnvelopeStatus;
  routing_mode: SigningRoutingMode;
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  documents: SigningDocumentDto[];
  recipients: SigningRecipientDto[];
  assignments: SigningAssignmentDto[];
}

// ---------------------------------------------------------------------------
// Progress computation (pure — drives the progress bar / matrix UI)
// ---------------------------------------------------------------------------

export interface SigningProgressGroup {
  id: string;
  total: number;
  signed: number;
  complete: boolean;
}

export interface SigningEnvelopeProgress {
  total_required: number;
  signed: number;
  /** 0–100, rounded. 100 only when every required assignment is signed. */
  percent: number;
  by_recipient: SigningProgressGroup[];
  by_document: SigningProgressGroup[];
}

/**
 * Compute progress across the document x recipient matrix. Only `required` assignments
 * count toward completion; optional ones are tracked but do not gate the percentage.
 */
export function computeSigningEnvelopeProgress(
  envelope: Pick<SigningEnvelopeDto, "documents" | "recipients" | "assignments">
): SigningEnvelopeProgress {
  const required = envelope.assignments.filter((a) => a.required);
  const signedCount = required.filter((a) => a.status === "SIGNED").length;
  const totalRequired = required.length;

  const groupBy = (
    ids: string[],
    pick: (a: SigningAssignmentDto) => string
  ): SigningProgressGroup[] =>
    ids.map((id) => {
      const forId = required.filter((a) => pick(a) === id);
      const signed = forId.filter((a) => a.status === "SIGNED").length;
      return {
        id,
        total: forId.length,
        signed,
        complete: forId.length > 0 && signed === forId.length,
      };
    });

  return {
    total_required: totalRequired,
    signed: signedCount,
    percent: totalRequired === 0 ? 0 : Math.round((signedCount / totalRequired) * 100),
    by_recipient: groupBy(
      envelope.recipients.map((r) => r.id),
      (a) => a.recipient_id
    ),
    by_document: groupBy(
      envelope.documents.map((d) => d.id),
      (a) => a.document_id
    ),
  };
}

// ---------------------------------------------------------------------------
// Status roll-up (pure) — turn per-assignment statuses into document / recipient
// / envelope statuses. Used by the webhook handler and the send flow so the whole
// graph stays consistent from a single source of truth.
// ---------------------------------------------------------------------------

export interface AssignmentStatusInput {
  status: SigningAssignmentStatus;
  required: boolean;
}

/** Roll a document's assignment statuses up to a document status. */
export function rollupDocumentStatus(
  assignments: AssignmentStatusInput[]
): SigningDocumentStatus {
  const required = assignments.filter((a) => a.required);
  if (required.length === 0) return "PENDING";
  const signed = required.filter((a) => a.status === "SIGNED").length;
  if (signed === required.length) return "COMPLETED";
  if (signed > 0) return "PARTIALLY_SIGNED";
  return "PENDING";
}

/** Roll a recipient's assignment statuses up to a recipient status. */
export function rollupRecipientStatus(
  statuses: SigningAssignmentStatus[]
): SigningRecipientStatus {
  if (statuses.length === 0) return "PENDING";
  if (statuses.some((s) => s === "DECLINED")) return "DECLINED";
  if (statuses.every((s) => s === "SIGNED")) return "SIGNED";
  if (statuses.some((s) => s === "SIGNED" || s === "VIEWED")) return "VIEWED";
  if (statuses.some((s) => s === "SENT")) return "SENT";
  return "PENDING";
}

/**
 * Roll all assignment statuses up to an envelope status. DRAFT / VOIDED / EXPIRED are
 * driven by explicit transitions (send / void / expiry job), not by this function.
 */
export function rollupEnvelopeStatus(
  assignments: AssignmentStatusInput[]
): Extract<SigningEnvelopeStatus, "SENT" | "IN_PROGRESS" | "COMPLETED" | "DECLINED"> {
  if (assignments.some((a) => a.status === "DECLINED")) return "DECLINED";
  const required = assignments.filter((a) => a.required);
  if (required.length > 0 && required.every((a) => a.status === "SIGNED")) {
    return "COMPLETED";
  }
  if (assignments.some((a) => a.status === "SIGNED" || a.status === "VIEWED")) {
    return "IN_PROGRESS";
  }
  return "SENT";
}
