import { BanknotesIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { ReviewSectionId } from "./section-types";

export interface SectionConfig {
  id: ReviewSectionId;
  label: string;
  /** Hero icon component - using @heroicons/react/24/outline */
  icon: React.ComponentType<{ className?: string }>;
  order: number;
}

/** Central registry of review sections. Used by tabs UI and section content renderer. */
export const REVIEW_SECTION_REGISTRY: SectionConfig[] = [
  { id: "FINANCIAL", label: "Financial", icon: BanknotesIcon, order: 0 },
  { id: "JUSTIFICATION", label: "Justification", icon: DocumentTextIcon, order: 1 },
  { id: "DOCUMENTS", label: "Document", icon: DocumentTextIcon, order: 2 },
];

export function getSectionById(id: ReviewSectionId): SectionConfig | undefined {
  return REVIEW_SECTION_REGISTRY.find((s) => s.id === id);
}

export function getSectionsInOrder(ids?: ReviewSectionId[]): SectionConfig[] {
  const source = ids && ids.length > 0 ? ids : (REVIEW_SECTION_REGISTRY.map((s) => s.id) as ReviewSectionId[]);
  const byId = new Map(REVIEW_SECTION_REGISTRY.map((s) => [s.id, s]));
  return source
    .map((id) => byId.get(id))
    .filter((s): s is SectionConfig => s != null)
    .sort((a, b) => a.order - b.order);
}
