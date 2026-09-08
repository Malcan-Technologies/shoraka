/** Open a PDF blob in a new tab and revoke the object URL after a minute. */
export function openPdfBlob(blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
