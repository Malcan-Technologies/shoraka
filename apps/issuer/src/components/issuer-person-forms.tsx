"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  monthlyIssuerPersonCopy,
  SC_DESIGNATION_LABELS,
  SC_DESIGNATIONS,
  SC_GENDER_LABELS,
  SC_GENDERS,
  SC_IDENTITY_PREFIXES,
  SC_MALAYSIAN_STATES,
  SC_MONTHLY_BOARD,
  SC_MONTHLY_PERSON_KIND_LABELS,
  SC_MONTHLY_SHAREHOLDER,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { ComRepFieldLabel, ProfileFieldGrid, ProfileReadField } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

export function PartyDetailFields({ party }: { party: OrganizationPartyProfileDto }) {
  const officer = party.isDirector || party.isBoard || party.isManagement;
  const copy = monthlyIssuerPersonCopy({ shareholder: party.isShareholder, officer });
  const shareType =
    party.shareType && party.shareType in SC_SHARE_TYPE_LABELS
      ? SC_SHARE_TYPE_LABELS[party.shareType]
      : party.shareType;
  const designation =
    party.designation && party.designation in SC_DESIGNATION_LABELS
      ? SC_DESIGNATION_LABELS[party.designation]
      : party.designation;
  const gender =
    party.gender && party.gender in SC_GENDER_LABELS ? SC_GENDER_LABELS[party.gender] : party.gender;
  const prefix =
    party.identityPrefix && party.identityPrefix in copy.identityPrefixLabels
      ? copy.identityPrefixLabels[party.identityPrefix as keyof typeof copy.identityPrefixLabels]
      : party.identityPrefix;
  const dateValue =
    party.entityType === "CORPORATE" ? formatDate(party.dateOfIncorporation) : formatDate(party.dateOfBirth);
  const nationalityValue =
    party.entityType === "CORPORATE" ? party.countryOfIncorporation : party.nationality;
  const personKindValue = [
    party.isBoard ? SC_MONTHLY_PERSON_KIND_LABELS.BOARD : null,
    party.isManagement ? SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT : null,
  ]
    .filter(Boolean)
    .join("; ");

  const items: Array<{ label: string; value: string; help?: string }> = [
    { label: copy.salutation.label, value: party.salutation || "—", help: copy.salutation.help },
    { label: copy.identityPrefix.label, value: prefix || "—" },
    { label: copy.identity.label, value: party.identityNumber || "—", help: copy.identity.help },
    { label: copy.gender.label, value: gender || "—", help: copy.gender.help },
    { label: copy.nationality.label, value: nationalityValue || "—", help: copy.nationality.help },
    { label: copy.dateOfBirth.label, value: dateValue, help: copy.dateOfBirth.help },
    { label: copy.address.label, value: party.address?.line1 || "—" },
    { label: "Address line 2", value: party.address?.line2 || "—" },
    { label: copy.addressState.label, value: party.address?.state || "—", help: copy.addressState.help },
    { label: copy.addressPostcode.label, value: party.address?.postalCode || "—", help: copy.addressPostcode.help },
  ];
  if (party.isShareholder) {
    items.push(
      { label: SC_MONTHLY_SHAREHOLDER.typeOfShares.label, value: shareType || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label, value: party.shareTypeOther || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label, value: party.shareholdingUnits || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label, value: party.shareholdingAmount || "—" },
      { label: SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label, value: party.shareholdingPercentage || "—" }
    );
  }
  if (officer) {
    items.push(
      { label: SC_MONTHLY_BOARD.boardOfDirectorManagementTeam.label, value: personKindValue || "—" },
      { label: SC_MONTHLY_BOARD.designation.label, value: designation || "—" },
      { label: SC_MONTHLY_BOARD.designationOthers.label, value: party.designationOther || "—", help: SC_MONTHLY_BOARD.designationOthers.help },
      { label: SC_MONTHLY_BOARD.appointmentDate.label, value: formatDate(party.appointmentDate) },
      { label: SC_MONTHLY_BOARD.resignationDate.label, value: formatDate(party.resignationDate), help: SC_MONTHLY_BOARD.resignationDate.help }
    );
  }
  return (
    <ProfileFieldGrid>
      {items.map((item) => (
        <ProfileReadField key={item.label} label={item.label} value={item.value} help={item.help} />
      ))}
    </ProfileFieldGrid>
  );
}

export function AddPersonForm({
  onSave,
  onCancel,
}: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [entityType, setEntityType] = React.useState<"INDIVIDUAL" | "CORPORATE">("INDIVIDUAL");
  const [isDirector, setIsDirector] = React.useState(false);
  const [isShareholder, setIsShareholder] = React.useState(false);
  const [isBoard, setIsBoard] = React.useState(false);
  const [isManagement, setIsManagement] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    salutation: "",
    identityPrefix: "NRIC",
    identityNumber: "",
    email: "",
    dateOfBirth: "",
    dateOfIncorporation: "",
    nationality: "",
    countryOfIncorporation: "",
    gender: "",
    line1: "",
    line2: "",
    state: "",
    postalCode: "",
    shareType: "",
    shareTypeOther: "",
    shareholdingUnits: "",
    shareholdingAmount: "",
    shareholdingPercentage: "",
    designation: "",
    designationOther: "",
    appointmentDate: "",
    resignationDate: "",
  });
  const save = useMutation({
    mutationFn: onSave,
    onError: (err: Error) => toast.error(err.message),
  });
  const corporate = entityType === "CORPORATE";
  const showShare = corporate || isShareholder;
  const showOfficer = !corporate && (isDirector || isBoard || isManagement);
  const copy = monthlyIssuerPersonCopy({ shareholder: showShare, officer: showOfficer });
  const prefixOptions = SC_IDENTITY_PREFIXES.filter((key) => copy.includeRocPrefix || key !== "ROC");

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await save.mutateAsync({
          entityType,
          name: form.name || null,
          salutation: form.salutation || null,
          identityPrefix: corporate ? "ROC" : form.identityPrefix || null,
          identityNumber: form.identityNumber || null,
          email: corporate ? null : form.email || null,
          isDirector: corporate ? false : isDirector,
          isShareholder: corporate ? true : isShareholder,
          isBoard: corporate ? false : isBoard,
          isManagement: corporate ? false : isManagement,
          dateOfBirth: form.dateOfBirth || null,
          dateOfIncorporation: form.dateOfIncorporation || null,
          nationality: form.nationality || null,
          countryOfIncorporation: form.countryOfIncorporation || null,
          gender: corporate ? "NOT_APPLICABLE" : form.gender || null,
          address:
            form.line1 || form.line2 || form.state || form.postalCode
              ? {
                  line1: form.line1 || null,
                  line2: form.line2 || null,
                  state: form.state || null,
                  postalCode: form.postalCode || null,
                }
              : null,
          shareType: showShare ? form.shareType || null : null,
          shareTypeOther: showShare && form.shareType === "OTHERS" ? form.shareTypeOther || null : null,
          shareholdingUnits: showShare ? form.shareholdingUnits || null : null,
          shareholdingAmount: showShare ? form.shareholdingAmount || null : null,
          shareholdingPercentage: showShare ? form.shareholdingPercentage || null : null,
          designation: showOfficer ? form.designation || null : null,
          designationOther: showOfficer && form.designation === "OTHERS" ? form.designationOther || null : null,
          appointmentDate: showOfficer ? form.appointmentDate || null : null,
          resignationDate: showOfficer ? form.resignationDate || null : null,
        });
      }}
    >
      <div className="space-y-2">
        <Label className="text-ui">Person / entity type</Label>
        <Select
          value={entityType}
          onValueChange={(value) => {
            const next = value as "INDIVIDUAL" | "CORPORATE";
            setEntityType(next);
            if (next === "CORPORATE") {
              setIsDirector(false);
              setIsBoard(false);
              setIsManagement(false);
              setIsShareholder(true);
              setForm((current) => ({ ...current, identityPrefix: "ROC" }));
            }
          }}
        >
          <SelectTrigger className="h-10 text-ui">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INDIVIDUAL">Individual</SelectItem>
            <SelectItem value="CORPORATE">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label className="text-ui">Roles</Label>
        <div className="flex flex-wrap gap-4">
          {corporate ? (
            <label className="flex items-center gap-2 text-ui">
              <Checkbox checked disabled />
              Shareholder
            </label>
          ) : (
            <>
              <RoleCheck label="Director" checked={isDirector} onChange={setIsDirector} />
              <RoleCheck label="Shareholder" checked={isShareholder} onChange={setIsShareholder} />
              <RoleCheck label={SC_MONTHLY_PERSON_KIND_LABELS.BOARD} checked={isBoard} onChange={setIsBoard} />
              <RoleCheck label={SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT} checked={isManagement} onChange={setIsManagement} />
            </>
          )}
        </div>
      </div>
      <TextField
        label={copy.name.label}
        value={form.name}
        onChange={(value) => setForm({ ...form, name: value })}
        required
        help={copy.name.help}
      />
      <TextField
        label={copy.salutation.label}
        value={form.salutation}
        onChange={(value) => setForm({ ...form, salutation: value })}
        help={copy.salutation.help}
      />
      {corporate ? (
        <TextField
          label={copy.identity.label}
          value={form.identityNumber}
          onChange={(value) => setForm({ ...form, identityNumber: value })}
          required
          help={copy.identity.help}
        />
      ) : (
        <>
          <SelectField
            label={copy.identityPrefix.label}
            value={form.identityPrefix}
            onChange={(value) => setForm({ ...form, identityPrefix: value })}
            options={prefixOptions.map((key) => ({
              value: key,
              label: copy.identityPrefixLabels[key as keyof typeof copy.identityPrefixLabels] ?? key,
            }))}
          />
          <TextField
            label={copy.identity.label}
            value={form.identityNumber}
            onChange={(value) => setForm({ ...form, identityNumber: value })}
            required
            help={copy.identity.help}
          />
          <TextField label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <DateField
            label={copy.dateOfBirth.label}
            value={form.dateOfBirth}
            onChange={(value) => setForm({ ...form, dateOfBirth: value })}
            help={copy.dateOfBirth.help}
          />
          <SelectField
            label={copy.gender.label}
            value={form.gender}
            onChange={(value) => setForm({ ...form, gender: value })}
            options={SC_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
            help={copy.gender.help}
          />
          <TextField
            label={copy.nationality.label}
            value={form.nationality}
            onChange={(value) => setForm({ ...form, nationality: value })}
            help={copy.nationality.help}
          />
        </>
      )}
      {corporate ? (
        <>
          <DateField
            label={copy.dateOfBirth.label}
            value={form.dateOfIncorporation}
            onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
            help={copy.dateOfBirth.help}
          />
          <TextField
            label={copy.nationality.label}
            value={form.countryOfIncorporation}
            onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
            help={copy.nationality.help}
          />
        </>
      ) : null}
      <TextField
        label={copy.address.label}
        value={form.line1}
        onChange={(value) => setForm({ ...form, line1: value })}
      />
      <TextField
        label="Address line 2"
        value={form.line2}
        onChange={(value) => setForm({ ...form, line2: value })}
      />
      <SelectField
        label={copy.addressState.label}
        value={form.state}
        onChange={(value) => setForm({ ...form, state: value })}
        options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
        help={copy.addressState.help}
      />
      <TextField
        label={copy.addressPostcode.label}
        value={form.postalCode}
        onChange={(value) => setForm({ ...form, postalCode: value })}
        help={copy.addressPostcode.help}
      />
      {showShare ? (
        <>
          <SelectField
            label={SC_MONTHLY_SHAREHOLDER.typeOfShares.label}
            value={form.shareType}
            onChange={(value) => setForm({ ...form, shareType: value })}
            options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
          />
          {form.shareType === "OTHERS" ? (
            <TextField
              label={SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label}
              value={form.shareTypeOther}
              onChange={(value) => setForm({ ...form, shareTypeOther: value })}
              required
            />
          ) : null}
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label}
            value={form.shareholdingUnits}
            onChange={(value) => setForm({ ...form, shareholdingUnits: value })}
          />
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label}
            value={form.shareholdingAmount}
            onChange={(value) => setForm({ ...form, shareholdingAmount: value })}
          />
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label}
            value={form.shareholdingPercentage}
            onChange={(value) => setForm({ ...form, shareholdingPercentage: value })}
          />
        </>
      ) : null}
      {showOfficer ? (
        <>
          <SelectField
            label={SC_MONTHLY_BOARD.designation.label}
            value={form.designation}
            onChange={(value) => setForm({ ...form, designation: value })}
            options={SC_DESIGNATIONS.map((key) => ({ value: key, label: SC_DESIGNATION_LABELS[key] }))}
          />
          {form.designation === "OTHERS" ? (
            <TextField
              label={SC_MONTHLY_BOARD.designationOthers.label}
              value={form.designationOther}
              onChange={(value) => setForm({ ...form, designationOther: value })}
              required
              help={SC_MONTHLY_BOARD.designationOthers.help}
            />
          ) : null}
          <DateField
            label={SC_MONTHLY_BOARD.appointmentDate.label}
            value={form.appointmentDate}
            onChange={(value) => setForm({ ...form, appointmentDate: value })}
          />
          <DateField
            label={SC_MONTHLY_BOARD.resignationDate.label}
            value={form.resignationDate}
            onChange={(value) => setForm({ ...form, resignationDate: value })}
            help={SC_MONTHLY_BOARD.resignationDate.help}
          />
        </>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" className="h-10" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save person"}
        </Button>
        <Button type="button" className="h-10" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function PartyFillEmptyForm({
  party,
  onSave,
  onCancel,
}: {
  party: OrganizationPartyProfileDto;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const save = useMutation({
    mutationFn: onSave,
    onError: (err: Error) => toast.error(err.message),
  });
  const [form, setForm] = React.useState({
    salutation: party.salutation ?? "",
    gender: party.gender ?? "",
    nationality: party.nationality ?? "",
    dateOfBirth: party.dateOfBirth?.slice(0, 10) ?? "",
    dateOfIncorporation: party.dateOfIncorporation?.slice(0, 10) ?? "",
    countryOfIncorporation: party.countryOfIncorporation ?? "",
    line1: party.address?.line1 ?? "",
    line2: party.address?.line2 ?? "",
    state: party.address?.state ?? "",
    postalCode: party.address?.postalCode ?? "",
    shareType: party.shareType ?? "",
    shareTypeOther: party.shareTypeOther ?? "",
    shareholdingUnits: party.shareholdingUnits ?? "",
    shareholdingAmount: party.shareholdingAmount ?? "",
    shareholdingPercentage: party.shareholdingPercentage ?? "",
    designation: party.designation ?? "",
    designationOther: party.designationOther ?? "",
    appointmentDate: party.appointmentDate?.slice(0, 10) ?? "",
    resignationDate: party.resignationDate?.slice(0, 10) ?? "",
  });
  const officer = party.isDirector || party.isBoard || party.isManagement;
  const copy = monthlyIssuerPersonCopy({ shareholder: party.isShareholder, officer });

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data: Record<string, unknown> = {};
        if (!party.salutation && form.salutation) data.salutation = form.salutation;
        if (party.entityType === "CORPORATE" && party.gender !== "NOT_APPLICABLE") {
          data.gender = "NOT_APPLICABLE";
        } else if (!party.gender && form.gender) {
          data.gender = form.gender;
        }
        if (!party.nationality && form.nationality) data.nationality = form.nationality;
        if (!party.dateOfBirth && form.dateOfBirth) data.dateOfBirth = form.dateOfBirth;
        if (!party.dateOfIncorporation && form.dateOfIncorporation) {
          data.dateOfIncorporation = form.dateOfIncorporation;
        }
        if (!party.countryOfIncorporation && form.countryOfIncorporation) {
          data.countryOfIncorporation = form.countryOfIncorporation;
        }
        if (!party.address?.line1 || !party.address?.line2 || !party.address?.state || !party.address?.postalCode) {
          data.address = {
            line1: form.line1 || party.address?.line1 || null,
            line2: form.line2 || party.address?.line2 || null,
            state: form.state || party.address?.state || null,
            postalCode: form.postalCode || party.address?.postalCode || null,
          };
        }
        if (party.isShareholder) {
          if (!party.shareType && form.shareType) data.shareType = form.shareType;
          if (!party.shareTypeOther && form.shareTypeOther) data.shareTypeOther = form.shareTypeOther;
          if (!party.shareholdingUnits && form.shareholdingUnits) data.shareholdingUnits = form.shareholdingUnits;
          if (!party.shareholdingAmount && form.shareholdingAmount) data.shareholdingAmount = form.shareholdingAmount;
          if (!party.shareholdingPercentage && form.shareholdingPercentage) {
            data.shareholdingPercentage = form.shareholdingPercentage;
          }
        }
        if (party.isDirector || party.isBoard || party.isManagement) {
          if (!party.designation && form.designation) data.designation = form.designation;
          if (!party.designationOther && form.designationOther) data.designationOther = form.designationOther;
          if (!party.appointmentDate && form.appointmentDate) data.appointmentDate = form.appointmentDate;
          if (!party.resignationDate && form.resignationDate) data.resignationDate = form.resignationDate;
        }
        await save.mutateAsync(data);
      }}
    >
      {!party.salutation ? (
        <TextField
          label={copy.salutation.label}
          value={form.salutation}
          onChange={(value) => setForm({ ...form, salutation: value })}
          help={copy.salutation.help}
        />
      ) : null}
      {party.entityType !== "CORPORATE" && !party.gender ? (
        <SelectField
          label={copy.gender.label}
          value={form.gender}
          onChange={(value) => setForm({ ...form, gender: value })}
          options={SC_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
          help={copy.gender.help}
        />
      ) : null}
      {!party.nationality && party.entityType !== "CORPORATE" ? (
        <TextField
          label={copy.nationality.label}
          value={form.nationality}
          onChange={(value) => setForm({ ...form, nationality: value })}
          help={copy.nationality.help}
        />
      ) : null}
      {party.entityType !== "CORPORATE" && !party.dateOfBirth ? (
        <DateField
          label={copy.dateOfBirth.label}
          value={form.dateOfBirth}
          onChange={(value) => setForm({ ...form, dateOfBirth: value })}
          help={copy.dateOfBirth.help}
        />
      ) : null}
      {party.entityType === "CORPORATE" && !party.dateOfIncorporation ? (
        <DateField
          label={copy.dateOfBirth.label}
          value={form.dateOfIncorporation}
          onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
          help={copy.dateOfBirth.help}
        />
      ) : null}
      {party.entityType === "CORPORATE" && !party.countryOfIncorporation ? (
        <TextField
          label={copy.nationality.label}
          value={form.countryOfIncorporation}
          onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
          help={copy.nationality.help}
        />
      ) : null}
      {!party.address?.line1 ? (
        <TextField label={copy.address.label} value={form.line1} onChange={(value) => setForm({ ...form, line1: value })} />
      ) : null}
      {!party.address?.line2 ? (
        <TextField
          label="Address line 2"
          value={form.line2}
          onChange={(value) => setForm({ ...form, line2: value })}
        />
      ) : null}
      {!party.address?.state ? (
        <SelectField
          label={copy.addressState.label}
          value={form.state}
          onChange={(value) => setForm({ ...form, state: value })}
          options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
          help={copy.addressState.help}
        />
      ) : null}
      {!party.address?.postalCode ? (
        <TextField
          label={copy.addressPostcode.label}
          value={form.postalCode}
          onChange={(value) => setForm({ ...form, postalCode: value })}
          help={copy.addressPostcode.help}
        />
      ) : null}
      {party.isShareholder && !party.shareType ? (
        <SelectField
          label={SC_MONTHLY_SHAREHOLDER.typeOfShares.label}
          value={form.shareType}
          onChange={(value) => setForm({ ...form, shareType: value })}
          options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
        />
      ) : null}
      {party.isShareholder && (party.shareType === "OTHERS" || form.shareType === "OTHERS") && !party.shareTypeOther ? (
        <TextField
          label={SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label}
          value={form.shareTypeOther}
          onChange={(value) => setForm({ ...form, shareTypeOther: value })}
          required
        />
      ) : null}
      {party.isShareholder && !party.shareholdingUnits ? (
        <TextField
          label={SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label}
          value={form.shareholdingUnits}
          onChange={(value) => setForm({ ...form, shareholdingUnits: value })}
        />
      ) : null}
      {party.isShareholder && !party.shareholdingAmount ? (
        <TextField
          label={SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label}
          value={form.shareholdingAmount}
          onChange={(value) => setForm({ ...form, shareholdingAmount: value })}
        />
      ) : null}
      {party.isShareholder && !party.shareholdingPercentage ? (
        <TextField
          label={SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label}
          value={form.shareholdingPercentage}
          onChange={(value) => setForm({ ...form, shareholdingPercentage: value })}
        />
      ) : null}
      {(party.isDirector || party.isBoard || party.isManagement) && !party.designation ? (
        <SelectField
          label={SC_MONTHLY_BOARD.designation.label}
          value={form.designation}
          onChange={(value) => setForm({ ...form, designation: value })}
          options={SC_DESIGNATIONS.map((key) => ({ value: key, label: SC_DESIGNATION_LABELS[key] }))}
        />
      ) : null}
      {(party.isDirector || party.isBoard || party.isManagement) &&
      (party.designation === "OTHERS" || form.designation === "OTHERS") &&
      !party.designationOther ? (
        <TextField
          label={SC_MONTHLY_BOARD.designationOthers.label}
          value={form.designationOther}
          onChange={(value) => setForm({ ...form, designationOther: value })}
          required
          help={SC_MONTHLY_BOARD.designationOthers.help}
        />
      ) : null}
      {(party.isDirector || party.isBoard || party.isManagement) && !party.appointmentDate ? (
        <DateField
          label={SC_MONTHLY_BOARD.appointmentDate.label}
          value={form.appointmentDate}
          onChange={(value) => setForm({ ...form, appointmentDate: value })}
        />
      ) : null}
      {(party.isDirector || party.isBoard || party.isManagement) && !party.resignationDate ? (
        <DateField
          label={SC_MONTHLY_BOARD.resignationDate.label}
          value={form.resignationDate}
          onChange={(value) => setForm({ ...form, resignationDate: value })}
          help={SC_MONTHLY_BOARD.resignationDate.help}
        />
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" className="h-10" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" className="h-10" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RoleCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-ui">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  help,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input className="h-10 text-ui" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  help,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input className="h-10 text-ui" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  help,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
