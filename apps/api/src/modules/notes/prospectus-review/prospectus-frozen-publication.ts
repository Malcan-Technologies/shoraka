/**
 * SECTION: Parse / merge frozen publication_content on prospectus_snapshot
 */

import { asJsonRecord } from "../prospectus/prospectus-json-guards";
import {
  toProspectusPublicationContent,
  type ProspectusFrozenPublicationContent,
  type ProspectusReviewStoredContent,
} from "./prospectus-review-content";
import type { ProspectusPublicationContent } from "../prospectus/prospectus-placeholder-publication-content";
import { prospectusReviewStoredContentSchema } from "./prospectus-review.schemas";

export function parseFrozenPublicationContent(
  prospectusSnapshot: unknown
): ProspectusFrozenPublicationContent | null {
  const root = asJsonRecord(prospectusSnapshot);
  const branch = asJsonRecord(root?.publication_content);
  if (!branch) return null;
  const contentParse = prospectusReviewStoredContentSchema.safeParse(branch.content);
  if (!contentParse.success) return null;
  if (
    typeof branch.version !== "string" ||
    typeof branch.optionCatalogueVersion !== "string" ||
    typeof branch.approvedAt !== "string" ||
    typeof branch.approvedBy !== "string"
  ) {
    return null;
  }
  return {
    version: branch.version,
    optionCatalogueVersion: branch.optionCatalogueVersion,
    approvedAt: branch.approvedAt,
    approvedBy: branch.approvedBy,
    content: contentParse.data as ProspectusReviewStoredContent,
  };
}

export function publicationContentFromFrozenSnapshot(
  prospectusSnapshot: unknown
): ProspectusPublicationContent | undefined {
  const frozen = parseFrozenPublicationContent(prospectusSnapshot);
  if (!frozen) return undefined;
  return toProspectusPublicationContent(frozen.content);
}

export function mergePublicationContentIntoSnapshot(
  existingSnapshot: unknown,
  frozen: ProspectusFrozenPublicationContent
): Record<string, unknown> {
  const existing = asJsonRecord(existingSnapshot) ?? {};
  return {
    ...existing,
    publication_content: frozen,
  };
}
