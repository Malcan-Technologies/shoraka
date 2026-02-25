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
export function ReviewFieldBlock({ title, children }: ReviewFieldBlockProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className={reviewSectionHeaderClass}>{title}</h3>
        <div className="mt-1.5 h-px bg-border" />
      </div>
      {children}
    </section>
  );
}
