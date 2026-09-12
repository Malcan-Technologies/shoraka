import type { ReviewSectionId } from "../review-registry";
import type { SectionCommentItem } from "../section-comments";

export type OfferAcceptanceCommentRecord = {
  id: string;
  scope?: string;
  scope_key?: string;
  remark?: string;
  comment?: string;
  created_at: string;
  author_user_id?: string;
  author?: { first_name?: string | null; last_name?: string | null } | null;
};

const MERGED_SCOPE_PREFIXES = [
  "contract_details:",
  "invoice_details:",
  "acceptance_documents:",
] as const;

export function offerAcceptanceCommentSourceLabel(
  scopeKey: string | undefined,
  structureType?: string | null
): string | undefined {
  const key = scopeKey ?? "";
  if (key.startsWith("contract_details:")) {
    return structureType === "invoice_only" ? "Customer" : "Facility";
  }
  if (key.startsWith("invoice_details:")) return "Invoice";
  if (key.startsWith("acceptance_documents:")) return "Acceptance";
  return undefined;
}

export function mergeOfferAcceptanceComments(
  comments: readonly OfferAcceptanceCommentRecord[],
  structureType?: string | null
): SectionCommentItem[] {
  return comments
    .filter((entry) => {
      if (entry.scope && entry.scope !== "comment") return false;
      const key = entry.scope_key ?? "";
      return MERGED_SCOPE_PREFIXES.some((prefix) => key.startsWith(prefix));
    })
    .map((entry) => ({
      id: entry.id,
      scope: entry.scope,
      scope_key: entry.scope_key,
      comment: (entry.comment ?? entry.remark ?? "").toString(),
      created_at: entry.created_at,
      author_user_id: entry.author_user_id,
      author: entry.author,
      sourceLabel: offerAcceptanceCommentSourceLabel(entry.scope_key, structureType),
    }))
    .sort((a, b) => {
      const aTime = Date.parse(a.created_at);
      const bTime = Date.parse(b.created_at);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
}

/** Composer posts to Acceptance when that section is in the unified tab, else commercial review. */
export function resolveOfferAcceptanceCommentSection(
  mergedSections: readonly ReviewSectionId[] | undefined
): ReviewSectionId {
  if (mergedSections?.includes("acceptance_documents")) return "acceptance_documents";
  if (mergedSections?.includes("invoice_details")) return "invoice_details";
  return "contract_details";
}
