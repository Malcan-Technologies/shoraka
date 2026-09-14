"use client";

import {
  buildCustomerPersonOverviewSections,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
  CUSTOMER_PERSON_LABEL,
  PROFILE_LABEL,
} from "@cashsouk/types";
import { PencilIcon } from "@heroicons/react/24/outline";
import { Button } from "../components/button";
import { ProfileFieldGrid, ProfileReadField } from "../components/profile-read-field";

export function CustomerPartyProfileOverview({
  party,
  person,
  variant = "simple",
  requiredMissingLabels,
  onEdit,
  editLabel = "Edit",
  showEditInAllSections = false,
}: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
  variant?: "simple" | "profile";
  requiredMissingLabels?: Set<string> | string[] | null;
  onEdit?: () => void;
  editLabel?: string;
  showEditInAllSections?: boolean;
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

  const corporate = (party?.entityType ?? person?.entityType) === "CORPORATE";
  const requiredMissing = new Set(requiredMissingLabels ?? []);
  // Completeness uses PROFILE_LABEL.shareholdingPercentage, while the UI surfaces it as "Shareholding".
  if (requiredMissing.has(PROFILE_LABEL.shareholdingPercentage)) {
    requiredMissing.add(CUSTOMER_PERSON_LABEL.shareholding);
  }

  const sectionIdForMissingLabel = (label: string): "details" | "role" | "contact" | "address" | null => {
    // These map the shared completeness “missing item labels” onto the Profile section that displays them.
    const detailLabels = new Set<string>(corporate ? [
      CUSTOMER_PERSON_LABEL.companyName,
      CUSTOMER_PERSON_LABEL.entityType,
      CUSTOMER_PERSON_LABEL.companyRegistrationNumber,
      CUSTOMER_PERSON_LABEL.identityType,
      CUSTOMER_PERSON_LABEL.dateOfIncorporation,
      CUSTOMER_PERSON_LABEL.countryOfIncorporation,
    ] : [
      CUSTOMER_PERSON_LABEL.fullName,
      CUSTOMER_PERSON_LABEL.entityType,
      CUSTOMER_PERSON_LABEL.salutation,
      CUSTOMER_PERSON_LABEL.identityType,
      CUSTOMER_PERSON_LABEL.identityNumber,
      CUSTOMER_PERSON_LABEL.gender,
      CUSTOMER_PERSON_LABEL.dateOfBirth,
      CUSTOMER_PERSON_LABEL.nationality,
    ]);

    const roleLabels = new Set<string>([
      CUSTOMER_PERSON_LABEL.roles,
      CUSTOMER_PERSON_LABEL.shareholding,
      CUSTOMER_PERSON_LABEL.typeOfShares,
      CUSTOMER_PERSON_LABEL.typeOfSharesOther,
      CUSTOMER_PERSON_LABEL.shareholdingUnits,
      CUSTOMER_PERSON_LABEL.shareholdingAmount,
      CUSTOMER_PERSON_LABEL.personKind,
      CUSTOMER_PERSON_LABEL.designation,
      CUSTOMER_PERSON_LABEL.designationOther,
      CUSTOMER_PERSON_LABEL.appointmentDate,
      CUSTOMER_PERSON_LABEL.resignationDate,
    ]);

    const contactLabels = new Set<string>([CUSTOMER_PERSON_LABEL.personEmail]);
    const addressLabels = new Set<string>([
      CUSTOMER_PERSON_LABEL.address,
      CUSTOMER_PERSON_LABEL.addressLine2,
      CUSTOMER_PERSON_LABEL.state,
      CUSTOMER_PERSON_LABEL.postcode,
    ]);

    if (detailLabels.has(label)) return "details";
    if (roleLabels.has(label)) return "role";
    if (contactLabels.has(label)) return "contact";
    if (addressLabels.has(label)) return "address";
    return null;
  };

  const sectionOrder: Array<"details" | "role" | "contact" | "address"> = corporate
    ? ["details", "role", "address"]
    : ["details", "role", "contact", "address"];

  const sectionsById = new Map(sections.map((s) => [s.id, s] as const));
  for (const missingLabel of requiredMissing) {
    const sectionId = sectionIdForMissingLabel(missingLabel);
    if (!sectionId) continue;
    if (!sectionsById.has(sectionId)) {
      const title =
        sectionId === "details"
          ? corporate
            ? "Company Details"
            : "Personal Details"
          : sectionId === "role"
            ? "Company Role"
            : sectionId === "contact"
              ? "Contact"
              : "Address";
      sectionsById.set(sectionId, { id: sectionId, title, fields: [] });
    }
    const section = sectionsById.get(sectionId)!;
    if (!section.fields.some((f) => f.label === missingLabel)) {
      section.fields.push({ label: missingLabel, value: "" });
    }
  }

  const profileSections = sectionOrder
    .map((id) => sectionsById.get(id))
    .filter(Boolean) as typeof sections;

  return (
    <div className="space-y-4">
      {profileSections.map((section, index) => (
        <div key={section.id} className="rounded-xl border bg-card">
          <div className="flex items-center justify-between gap-4 border-b p-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {onEdit && (showEditInAllSections || index === 0) ? (
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
                <ProfileReadField
                  key={`${section.id}-${item.label}`}
                  label={item.label}
                  required={requiredMissing.has(item.label)}
                  value={requiredMissing.has(item.label) ? "" : item.value}
                />
              ))}
            </ProfileFieldGrid>
          </div>
        </div>
      ))}
    </div>
  );
}
