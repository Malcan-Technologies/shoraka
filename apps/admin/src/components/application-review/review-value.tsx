"use client";

import {
  reviewValueClass,
  reviewValueClassTextArea,
  REVIEW_EMPTY_LABEL,
} from "./review-section-styles";

export interface ReviewValueProps {
  value: string;
  multiline?: boolean;
  className?: string;
}

/**
 * Displays a read-only value in review sections. Empty values use muted styling.
 */
export function ReviewValue({ value, multiline, className }: ReviewValueProps) {
  const isEmpty = value === REVIEW_EMPTY_LABEL;
  const baseClass = multiline ? reviewValueClassTextArea : reviewValueClass;
  return (
    <div className={`${baseClass} ${className ?? ""}`}>
      <span className={isEmpty ? "text-muted-foreground" : ""}>{value}</span>
    </div>
  );
}
