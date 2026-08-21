/** Human-readable upload formats for one supporting-document row (PDF and/or Excel). */
export function formatIssuerAllowedTypesLabel(types: string[]): string {
  const labels: string[] = [];
  if (types.includes("pdf")) labels.push("PDF (.pdf)");
  if (types.includes("excel")) labels.push("Excel (.xlsx, .xls)");
  if (labels.length === 0) return "PDF (.pdf)";
  return labels.join(" or ");
}

export function formatIssuerAllowedTypesHint(types: string[]): string {
  return `Accepted: ${formatIssuerAllowedTypesLabel(types)}`;
}
