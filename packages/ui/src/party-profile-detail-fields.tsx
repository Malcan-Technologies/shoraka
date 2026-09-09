"use client";

import {
  PERSON_EMAIL_HELP,
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
  if (!value) return "";
  return value.slice(0, 10);
}

function isPresent(value: unknown): boolean {
  return value != null && String(value).trim() !== "" && String(value).trim() !== "—";
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

export type PartyProfileDetailItem = { label: string; value: string; help?: string };

export function buildPartyProfileDetailItems(params: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}): PartyProfileDetailItem[] {
  const { party, person } = params;
  const officer = Boolean(party?.isDirector || party?.isBoard || party?.isManagement);
  const shareholder = Boolean(party?.isShareholder || person?.roles?.includes("SHAREHOLDER"));
  const copy = monthlyIssuerPersonCopy({ shareholder, officer });
  const shareType =
    party?.shareType && party.shareType in SC_SHARE_TYPE_LABELS
      ? SC_SHARE_TYPE_LABELS[party.shareType]
      : party?.shareType ?? "";
  const designation =
    party?.designation && party.designation in SC_DESIGNATION_LABELS
      ? SC_DESIGNATION_LABELS[party.designation]
      : party?.designation ?? "";
  const gender =
    party?.gender && party.gender in SC_GENDER_LABELS ? SC_GENDER_LABELS[party.gender] : party?.gender ?? "";
  const prefix =
    party?.identityPrefix && party.identityPrefix in copy.identityPrefixLabels
      ? copy.identityPrefixLabels[party.identityPrefix as keyof typeof copy.identityPrefixLabels]
      : party?.identityPrefix ?? "";
  const entityType = party?.entityType ?? person?.entityType ?? "INDIVIDUAL";
  const corporate = entityType === "CORPORATE";
  const dateValue = corporate ? formatDate(party?.dateOfIncorporation) : formatDate(party?.dateOfBirth);
  const nationalityValue = corporate ? party?.countryOfIncorporation : party?.nationality;
  const personKindValue = [
    party?.isBoard ? SC_MONTHLY_PERSON_KIND_LABELS.BOARD : null,
    party?.isManagement ? SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT : null,
  ]
    .filter(Boolean)
    .join("; ");
  const identity = party?.identityNumber || person?.matchKey || "";
  const personEmail = party?.email || person?.email || "";
  const loginEmail = party?.linkedUser?.email || "";
  const name = party?.name || person?.name || "";
  const roles = party
    ? formatPartyRoleLine(party)
    : (person?.roles ?? []).join(", ");
  const sharePct =
    party?.shareholdingPercentage ||
    (person?.sharePercentage != null ? String(person.sharePercentage) : "");

  const items: PartyProfileDetailItem[] = [
    { label: "Name", value: name },
    { label: "Entity type", value: corporate ? "Company" : "Individual" },
    { label: "Roles", value: roles },
  ];
  if (!corporate && isPresent(party?.salutation)) {
    items.push({ label: copy.salutation.label, value: party?.salutation ?? "", help: copy.salutation.help });
  }
  if (isPresent(prefix)) items.push({ label: copy.identityPrefix.label, value: prefix });
  if (isPresent(identity)) {
    items.push({ label: copy.identity.label, value: identity, help: copy.identity.help });
  }
  if (isPresent(personEmail)) {
    items.push({
      label: "Email",
      value: personEmail,
      help: PERSON_EMAIL_HELP,
    });
  }
  if (isPresent(loginEmail)) {
    items.push({
      label: "Platform login email",
      value: loginEmail,
      help: "Login email for the linked CashSouk account. Changing Person Email does not change this.",
    });
  }
  if (party) {
    if (!corporate && isPresent(gender)) {
      items.push({ label: copy.gender.label, value: gender, help: copy.gender.help });
    }
    if (isPresent(nationalityValue)) {
      items.push({ label: copy.nationality.label, value: nationalityValue ?? "", help: copy.nationality.help });
    }
    if (isPresent(dateValue)) {
      items.push({ label: copy.dateOfBirth.label, value: dateValue, help: copy.dateOfBirth.help });
    }
    if (isPresent(party.address?.line1)) {
      items.push({ label: copy.address.label, value: party.address?.line1 ?? "" });
    }
    if (isPresent(party.address?.line2)) {
      items.push({ label: "Address line 2", value: party.address?.line2 ?? "" });
    }
    if (isPresent(party.address?.state)) {
      items.push({ label: copy.addressState.label, value: party.address?.state ?? "" });
    }
    if (isPresent(party.address?.postalCode)) {
      items.push({ label: copy.addressPostcode.label, value: party.address?.postalCode ?? "" });
    }
  }
  if (shareholder) {
    if (isPresent(shareType)) {
      items.push({ label: SC_MONTHLY_SHAREHOLDER.typeOfShares.label, value: shareType });
    }
    if (party?.shareType === "OTHERS" && isPresent(party.shareTypeOther)) {
      items.push({ label: SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label, value: party.shareTypeOther ?? "" });
    }
    if (isPresent(party?.shareholdingUnits)) {
      items.push({
        label: SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label,
        value: party?.shareholdingUnits ?? "",
      });
    }
    if (isPresent(party?.shareholdingAmount)) {
      items.push({
        label: SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label,
        value: party?.shareholdingAmount ?? "",
      });
    }
    if (isPresent(sharePct)) {
      items.push({ label: SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label, value: sharePct });
    }
  }
  if (officer) {
    if (isPresent(personKindValue)) {
      items.push({ label: SC_MONTHLY_BOARD.boardOfDirectorManagementTeam.label, value: personKindValue });
    }
    if (isPresent(designation)) {
      items.push({ label: SC_MONTHLY_BOARD.designation.label, value: designation });
    }
    if (party?.designation === "OTHERS" && isPresent(party.designationOther)) {
      items.push({
        label: SC_MONTHLY_BOARD.designationOthers.label,
        value: party.designationOther ?? "",
        help: SC_MONTHLY_BOARD.designationOthers.help,
      });
    }
    if (isPresent(party?.appointmentDate)) {
      items.push({
        label: SC_MONTHLY_BOARD.appointmentDate.label,
        value: formatDate(party?.appointmentDate),
      });
    }
    if (isPresent(party?.resignationDate)) {
      items.push({
        label: SC_MONTHLY_BOARD.resignationDate.label,
        value: formatDate(party?.resignationDate),
        help: SC_MONTHLY_BOARD.resignationDate.help,
      });
    }
  }
  if (party?.absentFromLatestExternal) {
    items.push({
      label: "Latest CTOS information",
      value: "This person was not found in the latest CTOS information.",
    });
  } else if (party && party.mismatches.length > 0) {
    items.push({
      label: "Latest CTOS information",
      value: "CTOS information differs from the current profile.",
    });
  }
  return items.filter((item) => isPresent(item.value));
}

export function PartyProfileDetailFields({
  party,
  person,
}: {
  party?: OrganizationPartyProfileDto | null;
  person?: ApplicationPersonRow | null;
}) {
  const kyc = person
    ? getFinalStatusLabel(person, { displayMode: "kyc_only" })
    : { label: "—", tone: "neutral" as const };
  const aml = person
    ? getFinalStatusLabel({ screening: person.screening })
    : { label: "—", tone: "neutral" as const };
  const items = buildPartyProfileDetailItems({ party, person });

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
