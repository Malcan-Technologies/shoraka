"use client";

import { AcceptanceSection, type AcceptanceSectionProps } from "../sections/acceptance-section";

export function StageAcceptanceDocuments(props: AcceptanceSectionProps) {
  return (
    <AcceptanceSection
      {...props}
      contentMode="documents"
      embedded
      hideSectionComments
      hideCapacityTiles
    />
  );
}

export function StageInheritedAcceptance(props: AcceptanceSectionProps) {
  return (
    <AcceptanceSection
      {...props}
      embedded
      hideSectionComments
      hideCapacityTiles
    />
  );
}
