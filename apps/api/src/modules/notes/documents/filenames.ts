export function safeNoteDocumentFilename(noteReference: string, prefix: string): string {
  const ref = noteReference.replace(/[^\w.-]+/g, "-") || "note";
  return `${prefix}-${ref}.pdf`;
}

export function facilityAgreementPackageFilename(reference: string): string {
  return safeNoteDocumentFilename(reference, "Facility-Agreement-Package");
}

export function shorakaCertificateFilename(noteReference: string, tradeOrderId: string): string {
  const ref = noteReference.replace(/[^\w.-]+/g, "-") || "note";
  const suffix = tradeOrderId.replace(/[^\w.-]+/g, "").slice(-8) || "cert";
  return `Shoraka-Certificate-${ref}-${suffix}.pdf`;
}
