import type {
  LegalDocumentAudience,
  LegalDocumentDefinitionResponse,
  LegalDocumentType,
  LegalDocumentVersionStatus,
  LegalDocumentVersionSummary,
} from "@cashsouk/types";
import { LEGAL_DOCUMENT_TYPE_LABELS } from "@cashsouk/types";

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

export type LegalBadgeVariant = "success" | "secondary" | "muted" | "warning" | "info" | "outline";

export function legalStatusBadgeVariant(
  status: LegalDocumentVersionStatus
): LegalBadgeVariant {
  if (status === "PUBLISHED") return "success";
  if (status === "DRAFT") return "secondary";
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

export type LegalRowIconAction =
  | "download"
  | "edit"
  | "replaceDraft"
  | "uploadNew"
  | "archive";

export type LegalRowActions = {
  showPublishButton: boolean;
  icons: LegalRowIconAction[];
};

/** Compact icon actions by status (no ellipsis menu). */
export function getLegalDocumentRowActions(
  status: LegalDocumentVersionStatus,
  options: { hasCurrentVersion: boolean; hasDraft: boolean }
): LegalRowActions {
  const { hasCurrentVersion, hasDraft } = options;

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
    icons: [...(hasCurrentVersion ? (["download"] as LegalRowIconAction[]) : [])],
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
  return (doc.versions ?? []).find((v) => v.status === "PUBLISHED");
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

export function documentCurrentVersion(
  doc: LegalDocumentDefinitionResponse
): LegalDocumentVersionSummary | null {
  return (
    latestDraftVersion(doc) ??
    latestPublishedVersion(doc) ??
    (doc.versions ?? []).slice().sort((a, b) => b.version - a.version)[0] ??
    null
  );
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
  };
}

/** Edit payload keeps title synced to type label; description is not used in UI. */
export function buildEditDefinitionPayload(form: {
  type: LegalDocumentType;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
}) {
  return {
    title: legalDocumentDisplayName(form.type),
    description: null,
    audience: form.audience,
    requiredForOnboarding: form.requiredForOnboarding,
    publicVisibility: form.publicVisibility,
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
