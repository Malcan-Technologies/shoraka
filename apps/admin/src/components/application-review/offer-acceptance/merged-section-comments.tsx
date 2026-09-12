"use client";

import { SectionComments, type SectionCommentItem } from "../section-comments";
import type { ReviewSectionId } from "../review-registry";
import {
  mergeOfferAcceptanceComments,
  resolveOfferAcceptanceCommentSection,
  type OfferAcceptanceCommentRecord,
} from "./merge-offer-acceptance-comments";

export function MergedSectionComments({
  comments,
  structureType,
  mergedSections,
  onAddComment,
}: {
  comments: readonly OfferAcceptanceCommentRecord[];
  structureType?: string | null;
  mergedSections?: readonly ReviewSectionId[];
  onAddComment?: (section: ReviewSectionId, comment: string) => Promise<void> | void;
}) {
  const merged: SectionCommentItem[] = mergeOfferAcceptanceComments(comments, structureType);
  const postSection = resolveOfferAcceptanceCommentSection(mergedSections);
  return (
    <SectionComments
      comments={merged}
      onSubmitComment={
        onAddComment ? (comment) => onAddComment(postSection, comment) : undefined
      }
    />
  );
}
