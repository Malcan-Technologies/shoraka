import type {
  LegalDocumentAudience,
  LegalDocumentDefinitionResponse,
  LegalDocumentVersionStatus,
  LegalDocumentVersionSummary,
} from "@cashsouk/types";

export const MAX_LEGAL_PDF_BYTES = 10 * 1024 * 1024;

export const LEGAL_AUDIENCE_LABELS: Record<LegalDocumentAudience, string> = {
  BOTH: "Issuer & Investor",
  ISSUER: "Issuer",
  INVESTOR: "Investor",
  PUBLIC: "Public",
};

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
  type: string;
  title: string;
  description: string;
  audience: LegalDocumentAudience;
  requiredForOnboarding: boolean;
  publicVisibility: boolean;
};

export function buildCreateDefinitionPayload(form: CreateLegalDocumentFormValues) {
  return {
    type: form.type,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    audience: form.audience,
    requiredForOnboarding: form.requiredForOnboarding,
    publicVisibility: form.publicVisibility,
  };
}

/**
 * Tracks create+upload orchestration so a failed upload can retry without
 * creating a duplicate LegalDocument definition.
 */
export type CreateOrchestrationState = {
  definitionId: string | null;
  definitionTitle: string | null;
};

export function nextCreateOrchestrationAfterDefinition(
  definition: Pick<LegalDocumentDefinitionResponse, "id" | "title">
): CreateOrchestrationState {
  return { definitionId: definition.id, definitionTitle: definition.title };
}

export function resetCreateOrchestration(): CreateOrchestrationState {
  return { definitionId: null, definitionTitle: null };
}

export function shouldSkipDefinitionCreate(state: CreateOrchestrationState): boolean {
  return Boolean(state.definitionId);
}

/** Compact Admin publish dialog title: `Publish {title} v{n}?` */
export function buildPublishDialogTitle(
  title: string | null | undefined,
  typeLabel: string | null | undefined,
  version: number
): string {
  const name = (title?.trim() || typeLabel?.trim() || "document").trim();
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
