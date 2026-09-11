"use client";

import {
  buildCustomerPersonOverviewSections,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { ProfileFieldGrid, ProfileReadField } from "../components/profile-read-field";

export function CustomerPartyProfileOverview({
  party,
  person,
}: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}) {
  const sections = buildCustomerPersonOverviewSections({ party, person });
  if (sections.length === 0) {
    return <p className="text-ui text-muted-foreground">No profile details yet.</p>;
  }
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <h2 className="text-card-title">{section.title}</h2>
          <ProfileFieldGrid>
            {section.fields.map((item) => (
              <ProfileReadField key={`${section.id}-${item.label}`} label={item.label} value={item.value} />
            ))}
          </ProfileFieldGrid>
        </section>
      ))}
    </div>
  );
}
