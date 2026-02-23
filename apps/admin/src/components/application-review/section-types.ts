/** Canonical review section identifiers aligned with Prisma ReviewSection enum */
export const REVIEW_SECTION_IDS = ["FINANCIAL", "JUSTIFICATION", "DOCUMENTS"] as const;
export type ReviewSectionId = (typeof REVIEW_SECTION_IDS)[number];
