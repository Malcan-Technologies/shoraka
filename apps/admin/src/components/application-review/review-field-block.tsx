"use client";

import { reviewSectionHeaderClass } from "./review-section-styles";

export interface ReviewFieldBlockProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Section block with header, divider, and content. Matches application flow exactly:
 * business-details/company-details pattern — div with h3 + divider.
 */
export function ReviewFieldBlock({ title, children }: ReviewFieldBlockProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className={reviewSectionHeaderClass}>{title}</h3>
        <div className="border-b border-border mt-2 mb-4" />
      </div>
      {children}
    </section>
  );
}
