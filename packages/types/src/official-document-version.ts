/** Official artefact versions are stored as V01, V02, … */

export type OfficialDocumentReviewVersion = {
  version: string;
  status: "PENDING" | "READY" | "FAILED";
  generationError: string | null;
  generatedAt: string | null;
  canRetry: boolean;
  canPublish: boolean;
  viewUrl: string | null;
  downloadUrl: string | null;
  pdfExpiresIn: number | null;
  pdfFileName: string | null;
  pdfSha256: string | null;
};

export function parseOfficialDocumentVersionNumber(version: string): number {
  const match = /^V(\d+)$/i.exec(version.trim());
  return match ? Number(match[1]) : 0;
}

export function formatOfficialDocumentVersion(n: number): string {
  return `V${String(Math.max(1, n)).padStart(2, "0")}`;
}

export function nextOfficialDocumentVersion(version: string): string {
  return formatOfficialDocumentVersion(parseOfficialDocumentVersionNumber(version) + 1);
}

export function compareOfficialDocumentVersions(a: string, b: string): number {
  return parseOfficialDocumentVersionNumber(a) - parseOfficialDocumentVersionNumber(b);
}

export function latestOfficialDocumentVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  return versions.reduce((latest, current) =>
    compareOfficialDocumentVersions(current, latest) > 0 ? current : latest
  );
}
