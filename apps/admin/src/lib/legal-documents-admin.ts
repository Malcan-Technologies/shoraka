import type {
  LegalDocumentAudience,
  LegalDocumentDefinitionResponse,
  LegalDocumentType,
  LegalDocumentVersionStatus,
  LegalDocumentVersionSummary,
} from "@cashsouk/types";
import {
  LEGAL_DOCUMENT_DEFAULT_AUDIENCE,
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
} from "@cashsouk/types";

export const MAX_LEGAL_PDF_BYTES = 10 * 1024 * 1024;

/** Who must accept this document in a portal (not the same as website visibility). */
export const LEGAL_AUDIENCE_LABELS: Record<LegalDocumentAudience, string> = {
  BOTH: "Issuer & Investor",
  ISSUER: "Issuer",
  INVESTOR: "Investor",
  PUBLIC: "Public",
};

/** Audiences offered when creating/editing (exclude confusing PUBLIC). */
export const OPERATIONAL_AUDIENCES: LegalDocumentAudience[] = [
  "BOTH",
  "ISSUER",
  "INVESTOR",
];

export const LEGAL_STATUS_LABELS: Record<LegalDocumentVersionStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function audienceLabel(audience: LegalDocumentAudience): string {
  return LEGAL_AUDIENCE_LABELS[audience] ?? audience;
}

export function statusLabel(status: LegalDocumentVersionStatus): string {
  return LEGAL_STATUS_LABELS[status] ?? status;
}

export function websiteVisibilityLabel(visible: boolean): string {
  return visible ? "Public" : "Private";
}

export function accountVisibilityLabel(visible: boolean): string {
  return visible ? "In account" : "Hidden";
}

export type LegalBadgeVariant = "success" | "secondary" | "muted" | "warning" | "info" | "outline";

export function legalStatusToken(
  status: LegalDocumentVersionStatus
): "success" | "neutral" {
  if (status === "PUBLISHED") return "success";
  return "neutral";
}

export function legalStatusBadgeVariant(
  status: LegalDocumentVersionStatus
): LegalBadgeVariant {
  if (status === "PUBLISHED") return "success";
  if (status === "DRAFT") return "muted";
  return "muted";
}

export function onboardingBadgeVariant(required: boolean): LegalBadgeVariant {
  return required ? "warning" : "secondary";
}

export function onboardingBadgeLabel(required: boolean): string {
  return required ? "Required" : "Optional";
}

export function websiteBadgeVariant(visible: boolean): LegalBadgeVariant {
  return visible ? "info" : "secondary";
}

export function accountBadgeVariant(visible: boolean): LegalBadgeVariant {
  return visible ? "info" : "secondary";
}

/**
 * Re-acceptance applies only to the active Published version.
 * Draft / archived-only rows show "—".
 */
export function reacceptanceBadgeLabel(
  published: LegalDocumentVersionSummary | undefined | null
): string {
  if (!published || published.status !== "PUBLISHED") return "—";
  return published.reacceptanceRequired ? "Yes" : "No";
}

export function reacceptanceBadgeVariant(
  published: LegalDocumentVersionSummary | undefined | null
): LegalBadgeVariant {
  if (!published || published.status !== "PUBLISHED") return "muted";
  return published.reacceptanceRequired ? "warning" : "secondary";
}

export type LegalRowIconAction =
  | "download"
  | "edit"
  | "replaceDraft"
  | "uploadNew"
  | "restore"
  | "archive";

export type LegalRowActions = {
  showPublishButton: boolean;
  icons: LegalRowIconAction[];
};

/**
 * Restore rules for an archived version:
 * - previously published → only if no newer published version exists
 * - never published (archived draft) → only if no other draft exists
 */
export function canRestoreArchivedVersion(
  version: LegalDocumentVersionSummary,
  doc: LegalDocumentDefinitionResponse
): boolean {
  if (version.status !== "ARCHIVED") return false;

  if (version.publishedAt) {
    const published = latestPublishedVersion(doc);
    if (published && published.version > version.version) return false;
    if (published && published.id !== version.id) return false;
    return true;
  }

  const draft = latestDraftVersion(doc);
  if (draft && draft.id !== version.id) return false;
  return true;
}

/** Compact icon actions by status (no ellipsis menu). */
export function getLegalDocumentRowActions(
  status: LegalDocumentVersionStatus,
  options: {
    hasCurrentVersion: boolean;
    hasDraft: boolean;
    canRestore?: boolean;
  }
): LegalRowActions {
  const { hasCurrentVersion, hasDraft, canRestore = false } = options;

  if (status === "DRAFT") {
    return {
      showPublishButton: hasDraft,
      icons: [
        ...(hasCurrentVersion ? (["download"] as LegalRowIconAction[]) : []),
        "edit",
        ...(hasDraft ? (["replaceDraft"] as LegalRowIconAction[]) : []),
        ...(hasCurrentVersion ? (["archive"] as LegalRowIconAction[]) : []),
      ],
    };
  }

  if (status === "PUBLISHED") {
    return {
      showPublishButton: false,
      icons: [
        ...(hasCurrentVersion ? (["download"] as LegalRowIconAction[]) : []),
        "edit",
        "uploadNew",
        ...(hasCurrentVersion ? (["archive"] as LegalRowIconAction[]) : []),
      ],
    };
  }

  return {
    showPublishButton: false,
    icons: [
      ...(hasCurrentVersion ? (["download"] as LegalRowIconAction[]) : []),
      ...(canRestore ? (["restore"] as LegalRowIconAction[]) : []),
      "uploadNew",
    ],
  };
}

/** Show version-history control only when there is more than one version. */
export function hasLegalVersionHistory(
  doc: Pick<LegalDocumentDefinitionResponse, "versions">
): boolean {
  return (doc.versions?.length ?? 0) > 1;
}

export function formatLegalFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatLegalDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function latestPublishedVersion(
  doc: LegalDocumentDefinitionResponse
): LegalDocumentVersionSummary | undefined {
  return (doc.versions ?? [])
    .filter((v) => v.status === "PUBLISHED")
    .sort((a, b) => b.version - a.version)[0];
}

export function latestDraftVersion(
  doc: LegalDocumentDefinitionResponse
): LegalDocumentVersionSummary | undefined {
  return (doc.versions ?? [])
    .filter((v) => v.status === "DRAFT")
    .sort((a, b) => b.version - a.version)[0];
}

/** Row status: prefer draft when present, else published, else archived, else Draft placeholder. */
export function documentCurrentStatus(
  doc: LegalDocumentDefinitionResponse
): LegalDocumentVersionStatus {
  if (latestDraftVersion(doc)) return "DRAFT";
  if (latestPublishedVersion(doc)) return "PUBLISHED";
  const archived = (doc.versions ?? []).find((v) => v.status === "ARCHIVED");
  if (archived) return "ARCHIVED";
  return "DRAFT";
}

/** Row ops pointer: draft, else published, else highest archived (for admin actions only). */
export function documentCurrentVersion(
  doc: LegalDocumentDefinitionResponse
): LegalDocumentVersionSummary | null {
  return (
    latestDraftVersion(doc) ??
    latestPublishedVersion(doc) ??
    (doc.versions ?? [])
      .filter((v) => v.status === "ARCHIVED")
      .slice()
      .sort((a, b) => b.version - a.version)[0] ??
    null
  );
}

/** Active published only — never archived. */
export function hasActivePublishedVersion(
  doc: LegalDocumentDefinitionResponse
): boolean {
  return Boolean(latestPublishedVersion(doc));
}

/**
 * Version column label.
 * Draft / published show vN. When none published (and no draft), show "No published version".
 */
export function legalRowVersionLabel(doc: LegalDocumentDefinitionResponse): string {
  const draft = latestDraftVersion(doc);
  if (draft) return `v${draft.version}`;
  const published = latestPublishedVersion(doc);
  if (published) return `v${published.version}`;
  return "No published version";
}

export function isOnlyActivePublishedVersion(
  doc: LegalDocumentDefinitionResponse,
  version: LegalDocumentVersionSummary
): boolean {
  if (version.status !== "PUBLISHED") return false;
  const published = (doc.versions ?? []).filter((v) => v.status === "PUBLISHED");
  return published.length === 1 && published[0]?.id === version.id;
}

export function buildArchiveDialogCopy(input: {
  name: string;
  version: number;
  isPublished: boolean;
  isOnlyPublished: boolean;
  reacceptanceRequired: boolean;
}): { title: string; paragraphs: string[] } {
  const paragraphs = ["This version will become inactive immediately."];
  if (input.isPublished && input.isOnlyPublished) {
    paragraphs.push(
      "This legal document will have no published version. No older version will be activated automatically."
    );
  }
  if (input.reacceptanceRequired) {
    paragraphs.push(
      "Any pending acceptance requirement for this version will stop. Previous acceptance records will remain available for audit."
    );
  }
  return {
    title: `Archive ${input.name} v${input.version}?`,
    paragraphs,
  };
}

export const EXISTING_LEGAL_TYPE_CREATE_MESSAGE =
  "This legal document already exists. Upload a new version from the existing document instead.";

/** Types that already have a LegalDocument definition (including archived-only). */
export function existingLegalDocumentTypes(
  documents: Array<Pick<LegalDocumentDefinitionResponse, "type">>
): Set<LegalDocumentType> {
  return new Set(documents.map((doc) => doc.type));
}

export function availableLegalDocumentTypes(
  documents: Array<Pick<LegalDocumentDefinitionResponse, "type">>
): LegalDocumentType[] {
  const existing = existingLegalDocumentTypes(documents);
  return LEGAL_DOCUMENT_TYPES.filter((type) => !existing.has(type));
}

export function createFormDefaultsForAvailableTypes(
  available: LegalDocumentType[]
): {
  type: LegalDocumentType;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
  showInAccount: boolean;
  file: File | null;
} | null {
  const type = available[0];
  if (!type) return null;
  return {
    type,
    audience: LEGAL_DOCUMENT_DEFAULT_AUDIENCE[type],
    requiredForOnboarding: true,
    publicVisibility: false,
    showInAccount: false,
    file: null,
  };
}

export type PdfValidationResult = { ok: true; file: File } | { ok: false; error: string };

export function validateLegalPdfFile(file: File | null | undefined): PdfValidationResult {
  if (!file) {
    return { ok: false, error: "Please choose a PDF file." };
  }
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return { ok: false, error: "Only PDF files are allowed." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "The selected file is empty." };
  }
  if (file.size > MAX_LEGAL_PDF_BYTES) {
    return { ok: false, error: "PDF must be 10 MB or smaller." };
  }
  return { ok: true, file };
}

export type CreateLegalDocumentFormValues = {
  type: LegalDocumentType;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
  showInAccount: boolean;
};

/** Fixed display name from legal type (Admin no longer edits title/description). */
export function legalDocumentDisplayName(type: LegalDocumentType): string {
  return LEGAL_DOCUMENT_TYPE_LABELS[type];
}

export function buildCreateDefinitionPayload(form: CreateLegalDocumentFormValues) {
  return {
    type: form.type,
    title: legalDocumentDisplayName(form.type),
    audience: form.audience,
    requiredForOnboarding: form.requiredForOnboarding,
    publicVisibility: form.publicVisibility,
    showInAccount: form.showInAccount,
  };
}

/** Edit payload keeps title synced to type label; description is not used in UI. */
export function buildEditDefinitionPayload(form: {
  type: LegalDocumentType;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
  showInAccount: boolean;
}) {
  return {
    title: legalDocumentDisplayName(form.type),
    description: null,
    audience: form.audience,
    requiredForOnboarding: form.requiredForOnboarding,
    publicVisibility: form.publicVisibility,
    showInAccount: form.showInAccount,
  };
}

/**
 * Tracks create+upload(+publish) orchestration so a failed later step can retry
 * without creating a duplicate LegalDocument or duplicate draft version.
 */
export type CreateOrchestrationState = {
  definitionId: string | null;
  definitionTitle: string | null;
  /** Set after draft version is created; used to retry publish only. */
  versionId: string | null;
};

export function nextCreateOrchestrationAfterDefinition(
  definition: Pick<LegalDocumentDefinitionResponse, "id" | "title">
): CreateOrchestrationState {
  return {
    definitionId: definition.id,
    definitionTitle: definition.title,
    versionId: null,
  };
}

export function nextCreateOrchestrationAfterVersion(
  state: CreateOrchestrationState,
  versionId: string
): CreateOrchestrationState {
  return { ...state, versionId };
}

export function resetCreateOrchestration(): CreateOrchestrationState {
  return { definitionId: null, definitionTitle: null, versionId: null };
}

export function shouldSkipDefinitionCreate(state: CreateOrchestrationState): boolean {
  return Boolean(state.definitionId);
}

export function shouldSkipVersionUpload(state: CreateOrchestrationState): boolean {
  return Boolean(state.versionId);
}

/** Compact Admin publish dialog title: `Publish {type label} v{n}?` */
export function buildPublishDialogTitle(
  type: LegalDocumentType | string | null | undefined,
  version: number
): string {
  const name =
    (type && type in LEGAL_DOCUMENT_TYPE_LABELS
      ? LEGAL_DOCUMENT_TYPE_LABELS[type as LegalDocumentType]
      : null) || "document";
  return `Publish ${name} v${version}?`;
}

export function matchesClientFilters(
  doc: LegalDocumentDefinitionResponse,
  filters: {
    audience: string;
    status: string;
    publicVisibility: string;
    onboarding: string;
  }
): boolean {
  if (filters.audience !== "all" && doc.audience !== filters.audience) return false;
  if (filters.publicVisibility === "yes" && !doc.publicVisibility) return false;
  if (filters.publicVisibility === "no" && doc.publicVisibility) return false;
  if (filters.onboarding === "required" && !doc.requiredForOnboarding) return false;
  if (filters.onboarding === "optional" && doc.requiredForOnboarding) return false;
  if (filters.status !== "all" && documentCurrentStatus(doc) !== filters.status) return false;
  return true;
}
