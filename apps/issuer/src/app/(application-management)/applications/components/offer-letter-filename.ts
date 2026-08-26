/** User-facing download name. Uses a persisted canonical ref when present; never a raw CUID. */
export function offerLetterDownloadFileName(
  kind: "contract" | "invoice",
  canonicalReference: string | null | undefined
): string {
  const cleaned = (canonicalReference ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned ? `${kind}-offer-${cleaned}.pdf` : `${kind}-offer-letter.pdf`;
}
