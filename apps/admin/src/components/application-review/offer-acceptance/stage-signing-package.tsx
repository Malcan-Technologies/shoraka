"use client";

import { AcceptanceSection, type AcceptanceSectionProps } from "../sections/acceptance-section";

export function StageSigningPackage(props: AcceptanceSectionProps) {
  return (
    <AcceptanceSection
      {...props}
      contentMode="signing"
      embedded
      hideSectionComments
      hideCapacityTiles
    />
  );
}
