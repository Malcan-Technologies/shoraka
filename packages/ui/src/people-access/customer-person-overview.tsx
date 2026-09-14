"use client";

import {
  buildCustomerPersonOverviewSections,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { PencilIcon } from "@heroicons/react/24/outline";
import { Button } from "../components/button";
import { ProfileFieldGrid, ProfileReadField } from "../components/profile-read-field";

export function CustomerPartyProfileOverview({
  party,
  person,
  variant = "simple",
  onEdit,
  editLabel = "Edit",
}: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
  variant?: "simple" | "profile";
  onEdit?: () => void;
  editLabel?: string;
}) {
  const sections = buildCustomerPersonOverviewSections({ party, person });
  if (sections.length === 0) {
    return <p className="text-ui text-muted-foreground">No profile details yet.</p>;
  }

  if (variant !== "profile") {
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

  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={section.id} className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-4 border-b p-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {index === 0 && onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 rounded-xl"
                onClick={onEdit}
              >
                <PencilIcon className="h-4 w-4" aria-hidden />
                {editLabel}
              </Button>
            ) : null}
          </div>
          <div className="p-6">
            <ProfileFieldGrid>
              {section.fields.map((item) => (
                <ProfileReadField key={`${section.id}-${item.label}`} label={item.label} value={item.value} />
              ))}
            </ProfileFieldGrid>
          </div>
        </div>
      ))}
    </div>
  );
}
