export function downloadAuditExport(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}

export function auditExportFilename(prefix: string, format: "csv" | "json"): string {
  return `${prefix}-${new Date().toISOString().split("T")[0]}.${format}`;
}

export function truncatedExportDescription(): string {
  return "Export reached the 10,000-row cap. Narrow the filters to export the remaining records.";
}
