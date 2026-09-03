export type SigningCloudSignField = {
  fieldtype: "sign";
  top: number;
  left: number;
  height: number;
  width: number;
  pageindex: number;
};

/** Same rectangle as SigningCloud stacked defaults / PDFKit offer-letter blocks. */
export const SIGNING_CLOUD_STACKED_SIGN_FIELD = {
  fieldtype: "sign" as const,
  top: 549,
  left: 140,
  height: 30,
  width: 100,
};

const SIGN_FIELD = SIGNING_CLOUD_STACKED_SIGN_FIELD;

/**
 * One SigningCloud signset per signer, stacked so boxes do not overlap.
 * `pageindex` is 1-based (SigningCloud).
 */
export function buildStackedSigningCloudSignsets(
  signerCount: number,
  pageindex = 1
): SigningCloudSignField[][] {
  const verticalGap = SIGN_FIELD.height + 20;
  const count = Math.max(0, Math.floor(signerCount));
  return Array.from({ length: count }, (_, index) => [
    {
      ...SIGN_FIELD,
      pageindex,
      top: SIGN_FIELD.top - index * verticalGap,
    },
  ]);
}

/** Best-effort page count for Gotenberg PDFs. Falls back to 1. */
export function countPdfPages(buffer: Buffer): number {
  const latin1 = buffer.toString("latin1");
  const catalogCounts = [...latin1.matchAll(/\/Type\s*\/Pages\b[\s\S]{0,200}?\/Count\s+(\d+)/g)].map(
    (match) => Number(match[1])
  );
  const catalogMax = catalogCounts.filter((n) => Number.isFinite(n) && n > 0);
  if (catalogMax.length > 0) return Math.max(...catalogMax);

  const pageObjects = [...latin1.matchAll(/\/Type\s*\/Page\b/g)].length;
  return Math.max(1, pageObjects);
}
