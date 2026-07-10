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

export type SigningRecipientStatus = "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED";

export type SigningKycStatus = "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "FAILED";

export type SigningAction = "SIGN" | "UPLOAD" | "VIEW";

export type SigningAssignmentStatus = "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED";

export type SigningDocumentFileType = "pdf" | "excel";

/** Stable role keys used in signing templates. Extend this registry to add new roles. */
export type SigningRoleKey = "issuer_director" | "guarantor";

/** @deprecated Use SigningRoleKey. Kept for parsing legacy template JSON. */
export type SigningRoleSourceHint = SigningRoleKey | "platform" | "custom";

export interface SigningRoleDefinition {
  key: SigningRoleKey;
  label: string;
  /** Default KYC requirement for this role. */
  kyc_required: boolean;
  /** Default min recipients at offer bind time. */
  min_count: number;
  /** Default max recipients (null = unbounded). */
  max_count: number | null;
}

/** Extensible registry of predefined signer roles. Add entries here to support new roles. */
export const SIGNING_ROLE_REGISTRY: readonly SigningRoleDefinition[] = [
  {
    key: "issuer_director",
    label: "Issuer director",
    kyc_required: true,
    min_count: 1,
    max_count: null,
  },
  {
    key: "guarantor",
    label: "Guarantor",
    kyc_required: true,
    min_count: 1,
    max_count: null,
  },
] as const;

export function getSigningRoleDefinition(key: string): SigningRoleDefinition | undefined {
  return SIGNING_ROLE_REGISTRY.find((role) => role.key === key);
}

export function isSigningRoleKey(value: string): value is SigningRoleKey {
  return SIGNING_ROLE_REGISTRY.some((role) => role.key === value);
}

// ---------------------------------------------------------------------------
// Template config (product-level)
// ---------------------------------------------------------------------------

/** Key under which the signing template is stored inside Product.workflow config. */
export const SIGNING_TEMPLATE_WORKFLOW_KEY = "signing_template";

/** System template key for the placeholder guarantor agreement document. */
export const GUARANTOR_AGREEMENT_TEMPLATE_KEY = "guarantor_agreement";

/** Links a product post_application supporting doc step to the signing package. */
export interface SigningTemplateSupportingDocRef {
  /** Workflow step key from the product supporting_documents config. */
  step_key: string;
  /** Human label shown in admin/issuer UI. */
  label: string;
  /** Whether this document must be attached before the envelope can be sent. */
  required: boolean;
  /** Role keys whose bound people must sign this document. */
  signer_role_keys: string[];
}

export interface SigningTemplateRole {
  /** Stable machine key — must match a SigningRoleKey. */
  key: string;
  /** Human label derived from the role registry. */
  label: string;
  /** Legacy field parsed from old templates; mapped to key when present. */
  source_hint?: SigningRoleSourceHint;
  /** Display order for roles in admin UI (does not gate signing). */
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
  /** When source is ISSUER_UPLOAD, links to a product post_application supporting doc step. */
  supporting_doc_step_key?: string;
}

export interface SigningTemplateConfig {
  enabled: boolean;
  roles: SigningTemplateRole[];
  documents: SigningTemplateDocument[];
  /** Post-application supporting docs that require signature in the envelope. */
  supporting_docs?: SigningTemplateSupportingDocRef[];
}

export const DEFAULT_SIGNING_TEMPLATE_CONFIG: SigningTemplateConfig = {
  enabled: false,
  roles: [],
  documents: [],
  supporting_docs: [],
};

const DOCUMENT_SOURCES: readonly SigningDocumentSource[] = [
  "GENERATED_OFFER_LETTER",
  "ADMIN_UPLOAD",
  "ISSUER_UPLOAD",
  "TEMPLATE",
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

/** Map legacy per-instance keys (e.g. issuer_director_1) to registry role keys. */
export function canonicalSigningRoleKey(key: string): SigningRoleKey | null {
  const trimmed = key.trim();
  if (isSigningRoleKey(trimmed)) return trimmed;
  if (/^issuer_director(_\d+)?$/i.test(trimmed)) return "issuer_director";
  if (/^guarantor(_\d+)?$/i.test(trimmed)) return "guarantor";
  return null;
}

function normalizeRoleKey(raw: Record<string, unknown>, index: number): string {
  const key = asString(raw.key).trim();
  const fromKey = canonicalSigningRoleKey(key);
  if (fromKey) return fromKey;
  const hint = asString(raw.source_hint).trim();
  const fromHint = canonicalSigningRoleKey(hint);
  if (fromHint) return fromHint;
  if (hint === "issuer_director" || hint === "guarantor") return hint;
  return index === 0 ? "issuer_director" : "guarantor";
}

function parseTemplateRole(raw: unknown, index: number): SigningTemplateRole {
  const r = asRecord(raw);
  const key = normalizeRoleKey(r, index);
  const registry = getSigningRoleDefinition(key);
  const legacyHint = asString(r.source_hint).trim();
  return {
    key,
    label: asString(r.label).trim() || registry?.label || key,
    source_hint: legacyHint ? (legacyHint as SigningRoleSourceHint) : undefined,
    routing_order: asInt(r.routing_order, index),
    kyc_required: r.kyc_required !== false,
    min_count: Math.max(0, asInt(r.min_count, registry?.min_count ?? 1)),
    max_count:
      r.max_count === null || r.max_count === undefined
        ? (registry?.max_count ?? null)
        : Math.max(1, asInt(r.max_count, 1)),
  };
}

function parseSupportingDocRef(raw: unknown): SigningTemplateSupportingDocRef | null {
  const r = asRecord(raw);
  const stepKey = asString(r.step_key).trim();
  if (!stepKey) return null;
  const signerRoleKeys = Array.isArray(r.signer_role_keys)
    ? r.signer_role_keys.filter((k): k is string => typeof k === "string" && k.trim() !== "")
    : [];
  return {
    step_key: stepKey,
    label: asString(r.label).trim() || stepKey,
    required: r.required !== false,
    signer_role_keys: signerRoleKeys,
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
  const supportingDocStepKey = asString(r.supporting_doc_step_key).trim();
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
    supporting_doc_step_key: supportingDocStepKey || undefined,
  };
}

/** Tolerant parse of the template config from arbitrary JSON (never throws). */
export function parseSigningTemplateConfig(raw: unknown): SigningTemplateConfig {
  if (raw == null) return { ...DEFAULT_SIGNING_TEMPLATE_CONFIG };
  const r = asRecord(raw);
  const roles = Array.isArray(r.roles) ? r.roles.map(parseTemplateRole) : [];
  const documents = Array.isArray(r.documents) ? r.documents.map(parseTemplateDocument) : [];
  const supporting_docs = Array.isArray(r.supporting_docs)
    ? r.supporting_docs
        .map(parseSupportingDocRef)
        .filter((item): item is SigningTemplateSupportingDocRef => item != null)
    : [];
  return sanitizeSigningTemplateConfig({
    enabled: r.enabled === true,
    roles,
    documents: [...documents].sort((a, b) => a.order - b.order),
    supporting_docs,
  });
}

function mergeRoleMaxCount(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.max(a, b);
}

/** Normalize legacy duplicate role keys so documents and roles stay in sync. */
export function sanitizeSigningTemplateConfig(config: SigningTemplateConfig): SigningTemplateConfig {
  const remapRoleKeys = (keys: string[]): SigningRoleKey[] => [
    ...new Set(
      keys
        .map((key) => canonicalSigningRoleKey(key))
        .filter((key): key is SigningRoleKey => key != null)
    ),
  ];

  const documents = config.documents.map((doc) => ({
    ...doc,
    signer_role_keys: remapRoleKeys(doc.signer_role_keys),
  }));

  const supporting_docs = (config.supporting_docs ?? []).map((ref) => ({
    ...ref,
    signer_role_keys: remapRoleKeys(ref.signer_role_keys),
  }));

  const usedRoleKeys = new Set<SigningRoleKey>([
    ...documents.flatMap((doc) => doc.signer_role_keys),
    ...supporting_docs.flatMap((ref) => ref.signer_role_keys),
  ]);

  const mergedRoles = new Map<SigningRoleKey, SigningTemplateRole>();
  for (const role of config.roles) {
    const canonical = canonicalSigningRoleKey(role.key);
    if (!canonical) continue;
    const registry = getSigningRoleDefinition(canonical)!;
    const existing = mergedRoles.get(canonical);
    if (!existing) {
      mergedRoles.set(canonical, {
        ...role,
        key: canonical,
        label: registry.label,
        source_hint: role.source_hint ?? canonical,
        kyc_required: role.kyc_required !== false,
      });
      continue;
    }
    mergedRoles.set(canonical, {
      ...existing,
      min_count: Math.max(existing.min_count, role.min_count),
      max_count: mergeRoleMaxCount(existing.max_count, role.max_count),
      kyc_required: existing.kyc_required && role.kyc_required !== false,
    });
  }

  for (const key of usedRoleKeys) {
    if (!mergedRoles.has(key)) {
      mergedRoles.set(key, createDefaultRoleFromRegistry(key, mergedRoles.size));
    }
  }

  const roles = [...mergedRoles.values()]
    .filter((role) => usedRoleKeys.has(role.key as SigningRoleKey))
    .sort((a, b) => a.routing_order - b.routing_order)
    .map((role, index) => ({ ...role, routing_order: index }));

  return {
    ...config,
    documents,
    supporting_docs,
    roles,
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
  if (config.documents.length === 0 && (config.supporting_docs?.length ?? 0) === 0) {
    errors.push("Signing: add at least one document or post-application supporting doc.");
  }

  const roleKeys = new Set<string>();
  for (const role of config.roles) {
    if (!isSigningRoleKey(role.key)) {
      errors.push(`Signing: role "${role.key}" is not a supported role.`);
    }
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
    const docSignerRoleKeys = new Set<string>();
    for (const roleKey of doc.signer_role_keys) {
      if (!roleKeys.has(roleKey)) {
        errors.push(
          `Signing: document "${doc.name || doc.key}" references unknown role "${roleKey}".`
        );
      }
      if (docSignerRoleKeys.has(roleKey)) {
        errors.push(
          `Signing: document "${doc.name || doc.key}" assigns signer role "${roleKey}" more than once.`
        );
      }
      docSignerRoleKeys.add(roleKey);
    }
  }

  for (const ref of config.supporting_docs ?? []) {
    if (ref.signer_role_keys.length === 0) {
      errors.push(`Signing: supporting doc "${ref.label}" has no assigned signer role.`);
    }
    for (const roleKey of ref.signer_role_keys) {
      if (!roleKeys.has(roleKey)) {
        errors.push(
          `Signing: supporting doc "${ref.label}" references unknown role "${roleKey}".`
        );
      }
    }
  }

  return errors;
}

export function createDefaultRoleFromRegistry(
  roleKey: SigningRoleKey,
  roleIndex: number
): SigningTemplateRole {
  const def = getSigningRoleDefinition(roleKey)!;
  return {
    key: roleKey,
    label: def.label,
    routing_order: roleIndex,
    kyc_required: def.kyc_required,
    min_count: def.min_count,
    max_count: def.max_count,
  };
}

// ---------------------------------------------------------------------------
// Envelope planning (template + bound people -> envelope graph spec)
// ---------------------------------------------------------------------------

/** A real person the issuer binds to a template role at send time. */
export interface RecipientBinding {
  role_key: string;
  name: string;
  email: string;
  /** application_guarantors.id when pre-filled from a guarantor. */
  application_guarantor_id?: string | null;
  ic_number?: string | null;
}

export interface PlannedRecipient {
  ref: string;
  role_key: string;
  role_label: string;
  name: string;
  email: string;
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
  supporting_doc_step_key?: string;
}

export interface PlannedAssignment {
  document_ref: string;
  recipient_ref: string;
  required: boolean;
  action: SigningAction;
}

export interface EnvelopePlan {
  documents: PlannedDocument[];
  recipients: PlannedRecipient[];
  assignments: PlannedAssignment[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalize Malaysian IC to digits only for comparison. */
export function normalizeSigningIcNumber(ic: string): string {
  return ic.replace(/\D/g, "");
}

export function isValidSigningIcNumber(ic: string | null | undefined): boolean {
  return normalizeSigningIcNumber(String(ic ?? "")).length === 12;
}

/** Issuer directors must have IC bound at offer time; third parties can declare IC when opening the link. */
export function roleRequiresBindingIcAtOffer(
  role: Pick<SigningTemplateRole, "key" | "source_hint">
): boolean {
  const canonical = canonicalSigningRoleKey(role.key);
  return (
    canonical === "issuer_director" ||
    role.source_hint === "issuer_director"
  );
}

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
    const role = roleByKey.get(b.role_key)!;
    if (roleRequiresBindingIcAtOffer(role)) {
      if (!String(b.ic_number ?? "").trim()) {
        errors.push(`Recipient for "${role.label || role.key}" must include an IC number.`);
      } else if (!isValidSigningIcNumber(b.ic_number)) {
        errors.push(`Recipient for "${role.label || role.key}" must have a valid 12-digit IC number.`);
      }
    }
    // Non-director roles self-declare IC on the signing link; ignore any IC sent at bind time.
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

export function buildEnvelopePlanFromTemplate(
  template: SigningTemplateConfig,
  bindings: RecipientBinding[],
  options?: { issuerUploadS3Keys?: Map<string, string> }
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
        name: b.name.trim(),
        email: b.email.trim().toLowerCase(),
        application_guarantor_id: b.application_guarantor_id ?? null,
        ic_number: b.ic_number?.trim() || null,
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

  const templateDocuments: PlannedDocument[] = [...template.documents]
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
      supporting_doc_step_key: doc.supporting_doc_step_key,
    }));

  const supportingDocDocuments: PlannedDocument[] = (template.supporting_docs ?? []).map(
    (ref, index) => {
      const s3Key = options?.issuerUploadS3Keys?.get(ref.step_key);
      return {
        ref: `supporting_${ref.step_key}`,
        key: `supporting_${ref.step_key}`,
        name: ref.label,
        source: "ISSUER_UPLOAD" as const,
        required: ref.required,
        order: templateDocuments.length + index,
        template: s3Key ? { s3_key: s3Key, file_name: `${ref.label}.pdf` } : undefined,
        supporting_doc_step_key: ref.step_key,
      };
    }
  );

  const documents = [...templateDocuments, ...supportingDocDocuments];

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
  for (const ref of template.supporting_docs ?? []) {
    for (const roleKey of ref.signer_role_keys) {
      for (const recipient of recipientsByRole.get(roleKey) ?? []) {
        assignments.push({
          document_ref: `supporting_${ref.step_key}`,
          recipient_ref: recipient.ref,
          required: ref.required,
          action: "SIGN",
        });
      }
    }
  }

  return { documents, recipients, assignments };
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
  supporting_doc_step_key?: string | null;
}

export interface SigningRecipientDto {
  id: string;
  role_key: string;
  role_label: string;
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
  expires_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  documents: SigningDocumentDto[];
  recipients: SigningRecipientDto[];
  assignments: SigningAssignmentDto[];
}

export interface ExternalSigningSessionDto {
  envelope: SigningEnvelopeDto;
  recipient_id: string;
  /** True after the signer passes the IC access-code gate. */
  access_verified: boolean;
  /** True when this recipient must complete MyKad eKYC before signing. */
  kyc_required: boolean;
  kyc_status: SigningKycStatus;
  /** True when the envelope is COMPLETED / VOIDED / DECLINED / EXPIRED (read-only terminal). */
  package_closed?: boolean;
}

export interface VerifyExternalAccessCodeInput {
  ic_number: string;
}

export interface RecipientEkycSession {
  url: string;
  token: string;
  sdk_endpoint: string;
}

export interface RecipientEkycSessionStatus {
  status: "pending" | "verified" | "failed" | "error";
  last_error?: string | null;
}

export function normalizeSigningEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Next unsigned assignment for a recipient (document order, not routing order). */
export function findUnsignedSigningAssignmentForRecipient(
  envelope: Pick<SigningEnvelopeDto, "documents" | "recipients" | "assignments">,
  recipientId: string
): { document: SigningDocumentDto; recipient: SigningRecipientDto } | null {
  const recipient = envelope.recipients.find((item) => item.id === recipientId);
  if (!recipient) return null;

  const documentById = new Map(envelope.documents.map((document) => [document.id, document]));

  const pendingAssignments = envelope.assignments
    .filter((assignment) => {
      if (assignment.action !== "SIGN" || assignment.status === "SIGNED") return false;
      return assignment.recipient_id === recipientId;
    })
    .sort((left, right) => {
      const leftOrder = documentById.get(left.document_id)?.order ?? 0;
      const rightOrder = documentById.get(right.document_id)?.order ?? 0;
      return leftOrder - rightOrder;
    });

  const assignment = pendingAssignments[0];
  if (!assignment) return null;

  const document = documentById.get(assignment.document_id);
  if (!document) return null;

  return { document, recipient };
}

// ---------------------------------------------------------------------------
// Progress computation
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
  percent: number;
  by_recipient: SigningProgressGroup[];
  by_document: SigningProgressGroup[];
}

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

export interface AssignmentStatusInput {
  status: SigningAssignmentStatus;
  required: boolean;
}

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
