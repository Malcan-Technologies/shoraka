export function safeFacilityDocumentFilename(
  facilityReference: string,
  prefix: string
): string {
  const ref = facilityReference.replace(/[^\w.-]+/g, "-") || "facility";
  return `${prefix}-${ref}.pdf`;
}
