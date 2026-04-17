/**
 * Which revision snapshot field paths count as “real” changes for resubmit summary + admin comparison tabs.
 * Mirrors admin `review-section-has-resubmit-changes` rules so activity text and tab highlights stay aligned.
 */

/**
 * True if this diff path should appear in APPLICATION_RESUBMITTED metadata and activity summaries.
 */
export function isMeaningfulResubmitSnapshotFieldPath(path: string): boolean {
  if (!path || typeof path !== "string") return false;

  const first = path.split(/[.[\]]/)[0] ?? "";

  if (first === "contract") {
    if (path === "contract") return false;
    if (!path.startsWith("contract.")) return false;
    const sub = path.slice("contract.".length);
    const head = sub.split(/[.[\]]/)[0] ?? "";
    return (
      head === "contract_details" ||
      head === "customer_details" ||
      head === "offer_details"
    );
  }

  if (first === "invoices") {
    if (path === "invoices" || path === "invoices.length") return true;
    if (!path.startsWith("invoices[")) return false;
    if (/^invoices\[[^\]]+\]$/.test(path)) return true;
    return (
      /invoices\[[^\]]+\]\.details(?:\.|$)/.test(path) ||
      /invoices\[[^\]]+\]\.offer_details(?:\.|$)/.test(path) ||
      /invoices\[[^\]]+\]\.offer_signing(?:\.|$)/.test(path)
    );
  }

  return true;
}
