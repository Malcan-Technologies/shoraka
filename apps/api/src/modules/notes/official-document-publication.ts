import { latestOfficialDocumentVersion } from "@cashsouk/types";

type VersionedRow = {
  version: string;
  is_current?: boolean | null;
};

export function currentOfficialDocumentVersion(rows: VersionedRow[]): string | null {
  const current = rows.filter((row) => row.is_current === true).map((row) => row.version);
  return latestOfficialDocumentVersion(current);
}

export function unpublishedLatestOfficialDocumentVersion(
  rows: VersionedRow[],
  currentVersion: string | null
): string | null {
  const latest = latestOfficialDocumentVersion(rows.map((row) => row.version));
  if (!latest || latest === currentVersion) return null;
  return latest;
}
