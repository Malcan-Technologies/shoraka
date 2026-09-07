"use client";

import {
  SC_DESIGNATION_LABELS,
  SC_GENDER_LABELS,
  SC_MONTHLY_BOARD,
  SC_MONTHLY_PERSON_KIND_LABELS,
  SC_MONTHLY_SHAREHOLDER,
  SC_SHARE_TYPE_LABELS,
  formatPartyRoleLine,
  getFinalStatusLabel,
  getFinalStatusToken,
  monthlyIssuerPersonCopy,
  partyRoleLabels,
  type ApplicationPersonRow,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { ProfileFieldGrid, ProfileReadField } from "./components/profile-read-field";
import { StatusBadge } from "./components/status-badge";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function PartyRoleBadges({
  party,
  person,
}: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}) {
  const labels = party
    ? partyRoleLabels(party)
    : (person?.roles ?? []).map((role) => role.charAt(0) + role.slice(1).toLowerCase());
  if (labels.length === 0) return <p className="text-meta text-muted-foreground">—</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full border border-border bg-muted px-2 py-0.5 text-meta text-foreground"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

export function PartyProfileDetailFields({
  party,
  person,
}: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}) {
  const officer = Boolean(party?.isDirector || party?.isBoard || party?.isManagement);
  const copy = monthlyIssuerPersonCopy({
    shareholder: Boolean(party?.isShareholder || person?.roles?.includes("SHAREHOLDER")),
    officer,
  });
  const shareType =
    party?.shareType && party.shareType in SC_SHARE_TYPE_LABELS
      ? SC_SHARE_TYPE_LABELS[party.shareType]
      : party?.shareType;
  const designation =
    party?.designation && party.designation in SC_DESIGNATION_LABELS
      ? SC_DESIGNATION_LABELS[party.designation]
      : party?.designation;
  const gender =
    party?.gender && party.gender in SC_GENDER_LABELS ? SC_GENDER_LABELS[party.gender] : party?.gender;
  const prefix =
    party?.identityPrefix && party.identityPrefix in copy.identityPrefixLabels
      ? copy.identityPrefixLabels[party.identityPrefix as keyof typeof copy.identityPrefixLabels]
      : party?.identityPrefix;
  const dateValue =
    party?.entityType === "CORPORATE"
      ? formatDate(party.dateOfIncorporation)
      : formatDate(party?.dateOfBirth);
  const nationalityValue =
    party?.entityType === "CORPORATE" ? party?.countryOfIncorporation : party?.nationality;
  const personKindValue = [
    party?.isBoard ? SC_MONTHLY_PERSON_KIND_LABELS.BOARD : null,
    party?.isManagement ? SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT : null,
  ]
    .filter(Boolean)
    .join("; ");
  const kyc = person
    ? getFinalStatusLabel(person, { displayMode: "kyc_only" })
    : { label: "—", tone: "neutral" as const };
  const aml = person
    ? getFinalStatusLabel({ screening: person.screening })
    : { label: "—", tone: "neutral" as const };
  const entityType = party?.entityType ?? person?.entityType ?? "INDIVIDUAL";
  const identity = party?.identityNumber || person?.matchKey || "—";
  const email = person?.email || "—";

  const items: Array<{ label: string; value: string; help?: string }> = [
    { label: "Entity type", value: entityType === "CORPORATE" ? "Company" : "Individual" },
    { label: "Roles", value: party ? formatPartyRoleLine(party) : (person?.roles ?? []).join(", ") || "—" },
    { label: copy.salutation.label, value: party?.salutation || "—", help: copy.salutation.help },
    { label: copy.identityPrefix.label, value: prefix || "—" },
    { label: copy.identity.label, value: identity, help: copy.identity.help },
    { label: "E-mail", value: email },
    { label: copy.gender.label, value: gender || "—", help: copy.gender.help },
    { label: copy.nationality.label, value: nationalityValue || "—" },
    { label: copy.dateOfBirth.label, value: dateValue || "—", help: copy.dateOfBirth.help },
    { label: copy.address.label, value: party?.address?.line1 || "—" },
    { label: "Address line 2", value: party?.address?.line2 || "—" },
    { label: copy.addressState.label, value: party?.address?.state || "—" },
    { label: copy.addressPostcode.label, value: party?.address?.postalCode || "—" },
  ];
  if (party?.isShareholder) {
    items.push(
      { label: SC_MONTHLY_SHAREHOLDER.typeOfShares.label, value: shareType || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label, value: party.shareTypeOther || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label, value: party.shareholdingUnits || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label, value: party.shareholdingAmount || "—" },
      {
        label: SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label,
        value: party.shareholdingPercentage || "—",
      }
    );
  }
  if (officer) {
    items.push(
      { label: SC_MONTHLY_BOARD.boardOfDirectorManagementTeam.label, value: personKindValue || "—" },
      { label: SC_MONTHLY_BOARD.designation.label, value: designation || "—" },
      {
        label: SC_MONTHLY_BOARD.designationOthers.label,
        value: party?.designationOther || "—",
        help: SC_MONTHLY_BOARD.designationOthers.help,
      },
      { label: SC_MONTHLY_BOARD.appointmentDate.label, value: formatDate(party?.appointmentDate) },
      {
        label: SC_MONTHLY_BOARD.resignationDate.label,
        value: formatDate(party?.resignationDate),
        help: SC_MONTHLY_BOARD.resignationDate.help,
      }
    );
  }
  if (party?.absentFromLatestExternal) {
    items.push({
      label: "Latest external information",
      value: "This person was not found in the latest external information.",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={getFinalStatusToken(kyc.tone)} label={`KYC: ${kyc.label}`} />
        <StatusBadge status={getFinalStatusToken(aml.tone)} label={`AML: ${aml.label}`} />
      </div>
      <PartyRoleBadges party={party} person={person} />
      <ProfileFieldGrid>
        {items.map((item) => (
          <ProfileReadField key={item.label} label={item.label} value={item.value} help={item.help} />
        ))}
      </ProfileFieldGrid>
    </div>
  );
}
