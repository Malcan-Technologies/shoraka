"use client";

import { PortalPeopleSection } from "@cashsouk/ui";
import type { ApplicationPersonRow, DirectorShareholderListSource } from "@cashsouk/types";

export function IssuerPeopleSection({
  organizationId,
  organizationOnboardingStatus,
  people,
  directorShareholderListSource,
  ctosDirectorShareholderWarning,
  focusedMatchKey,
  canEdit,
  onChanged,
}: {
  organizationId: string;
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  directorShareholderListSource?: DirectorShareholderListSource | null;
  ctosDirectorShareholderWarning?: string | null;
  focusedMatchKey?: string | null;
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  return (
    <PortalPeopleSection
      portal="issuer"
      organizationId={organizationId}
      organizationOnboardingStatus={organizationOnboardingStatus}
      people={people}
      directorShareholderListSource={directorShareholderListSource}
      ctosDirectorShareholderWarning={ctosDirectorShareholderWarning}
      focusedMatchKey={focusedMatchKey}
      canEdit={canEdit}
      canInactivate={canEdit}
      onChanged={onChanged}
    />
  );
}
