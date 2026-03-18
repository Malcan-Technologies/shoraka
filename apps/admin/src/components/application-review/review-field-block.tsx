"use client";

import { reviewSectionHeaderClass } from "./review-section-styles";

export interface ReviewFieldBlockProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Section block with header, divider, and content. Used for "Contract details",
 * "Customer details", "About your business", etc.
 */
/** Section block with header and divider. Matches application flow: border-b, mt-2 mb-4. */
export function ReviewFieldBlock({ title, children }: ReviewFieldBlockProps) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className={reviewSectionHeaderClass}>{title}</h3>
        <div className="border-b border-border mt-2 mb-4" />
      </div>
      {children}
    </section>
  );
}
