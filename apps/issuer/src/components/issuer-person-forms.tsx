"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  SC_DESIGNATION_LABELS,
  SC_DESIGNATIONS,
  SC_GENDER_LABELS,
  SC_GENDERS,
  SC_IDENTITY_PREFIX_LABELS,
  SC_IDENTITY_PREFIXES,
  SC_MALAYSIAN_STATES,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { ProfileFieldGrid, ProfileReadField } from "@cashsouk/ui";
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
    party.identityPrefix && party.identityPrefix in SC_IDENTITY_PREFIX_LABELS
      ? SC_IDENTITY_PREFIX_LABELS[party.identityPrefix]
      : party.identityPrefix;

  const items = [
    { label: "Identity prefix", value: prefix || "—" },
    { label: "Identity number", value: party.identityNumber || "—" },
    { label: "Gender", value: gender || "—" },
    { label: "Nationality", value: party.nationality || "—" },
    { label: "Date of birth", value: formatDate(party.dateOfBirth) },
    { label: "Date of incorporation", value: formatDate(party.dateOfIncorporation) },
    { label: "Address", value: party.address?.line1 || "—" },
    { label: "State", value: party.address?.state || "—" },
    { label: "Postcode", value: party.address?.postalCode || "—" },
  ];
  if (party.isShareholder) {
    items.push(
      { label: "Type of shares", value: shareType || "—" },
      { label: "Shareholding units", value: party.shareholdingUnits || "—" },
      { label: "Shareholding amount", value: party.shareholdingAmount || "—" },
      { label: "Shareholding percentage", value: party.shareholdingPercentage || "—" }
    );
  }
  if (party.isDirector || party.isBoard || party.isManagement) {
    items.push(
      { label: "Designation", value: designation || "—" },
      { label: "Appointment date", value: formatDate(party.appointmentDate) }
    );
  }
  return (
    <ProfileFieldGrid>
      {items.map((item) => (
        <ProfileReadField key={item.label} label={item.label} value={item.value} />
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
    identityPrefix: "NRIC",
    identityNumber: "",
    email: "",
    dateOfBirth: "",
    dateOfIncorporation: "",
    nationality: "",
    countryOfIncorporation: "",
    gender: "",
    line1: "",
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
  });
  const save = useMutation({
    mutationFn: onSave,
    onError: (err: Error) => toast.error(err.message),
  });
  const corporate = entityType === "CORPORATE";
  const showShare = corporate || isShareholder;
  const showOfficer = !corporate && (isDirector || isBoard || isManagement);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await save.mutateAsync({
          entityType,
          name: form.name || null,
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
          gender: form.gender || null,
          address:
            form.line1 || form.state || form.postalCode
              ? { line1: form.line1 || null, state: form.state || null, postalCode: form.postalCode || null }
              : null,
          shareType: showShare ? form.shareType || null : null,
          shareTypeOther: showShare ? form.shareTypeOther || null : null,
          shareholdingUnits: showShare ? form.shareholdingUnits || null : null,
          shareholdingAmount: showShare ? form.shareholdingAmount || null : null,
          shareholdingPercentage: showShare ? form.shareholdingPercentage || null : null,
          designation: showOfficer ? form.designation || null : null,
          designationOther: showOfficer ? form.designationOther || null : null,
          appointmentDate: showOfficer ? form.appointmentDate || null : null,
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
              <RoleCheck label="Board" checked={isBoard} onChange={setIsBoard} />
              <RoleCheck label="Management" checked={isManagement} onChange={setIsManagement} />
            </>
          )}
        </div>
      </div>
      <TextField
        label={corporate ? "Company name" : "Name"}
        value={form.name}
        onChange={(value) => setForm({ ...form, name: value })}
      />
      {corporate ? (
        <TextField
          label="ROC / registration number"
          value={form.identityNumber}
          onChange={(value) => setForm({ ...form, identityNumber: value })}
        />
      ) : (
        <>
          <SelectField
            label="Identity prefix"
            value={form.identityPrefix}
            onChange={(value) => setForm({ ...form, identityPrefix: value })}
            options={SC_IDENTITY_PREFIXES.filter((key) => key !== "ROC").map((key) => ({
              value: key,
              label: SC_IDENTITY_PREFIX_LABELS[key],
            }))}
          />
          <TextField
            label="NRIC / passport"
            value={form.identityNumber}
            onChange={(value) => setForm({ ...form, identityNumber: value })}
          />
          <TextField label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <DateField
            label="Date of birth"
            value={form.dateOfBirth}
            onChange={(value) => setForm({ ...form, dateOfBirth: value })}
          />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(value) => setForm({ ...form, gender: value })}
            options={SC_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
          />
          <TextField
            label="Nationality"
            value={form.nationality}
            onChange={(value) => setForm({ ...form, nationality: value })}
          />
        </>
      )}
      {corporate ? (
        <>
          <DateField
            label="Date of incorporation"
            value={form.dateOfIncorporation}
            onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
          />
          <TextField
            label="Country of incorporation"
            value={form.countryOfIncorporation}
            onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
          />
        </>
      ) : null}
      <TextField
        label={corporate ? "Business address" : "Address"}
        value={form.line1}
        onChange={(value) => setForm({ ...form, line1: value })}
      />
      <SelectField
        label="State"
        value={form.state}
        onChange={(value) => setForm({ ...form, state: value })}
        options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
      />
      <TextField
        label="Postcode"
        value={form.postalCode}
        onChange={(value) => setForm({ ...form, postalCode: value })}
      />
      {showShare ? (
        <>
          <SelectField
            label="Type of shares"
            value={form.shareType}
            onChange={(value) => setForm({ ...form, shareType: value })}
            options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
          />
          <TextField
            label="Shareholding units"
            value={form.shareholdingUnits}
            onChange={(value) => setForm({ ...form, shareholdingUnits: value })}
          />
          <TextField
            label="Shareholding amount"
            value={form.shareholdingAmount}
            onChange={(value) => setForm({ ...form, shareholdingAmount: value })}
          />
          <TextField
            label="Shareholding percentage"
            value={form.shareholdingPercentage}
            onChange={(value) => setForm({ ...form, shareholdingPercentage: value })}
          />
        </>
      ) : null}
      {showOfficer ? (
        <>
          <SelectField
            label="Designation"
            value={form.designation}
            onChange={(value) => setForm({ ...form, designation: value })}
            options={SC_DESIGNATIONS.map((key) => ({ value: key, label: SC_DESIGNATION_LABELS[key] }))}
          />
          <DateField
            label="Appointment date"
            value={form.appointmentDate}
            onChange={(value) => setForm({ ...form, appointmentDate: value })}
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
    gender: party.gender ?? "",
    nationality: party.nationality ?? "",
    dateOfBirth: party.dateOfBirth?.slice(0, 10) ?? "",
    line1: party.address?.line1 ?? "",
    state: party.address?.state ?? "",
    postalCode: party.address?.postalCode ?? "",
    shareType: party.shareType ?? "",
    shareholdingUnits: party.shareholdingUnits ?? "",
    shareholdingAmount: party.shareholdingAmount ?? "",
    shareholdingPercentage: party.shareholdingPercentage ?? "",
    designation: party.designation ?? "",
    appointmentDate: party.appointmentDate?.slice(0, 10) ?? "",
  });

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const data: Record<string, unknown> = {};
        if (!party.gender && form.gender) data.gender = form.gender;
        if (!party.nationality && form.nationality) data.nationality = form.nationality;
        if (!party.dateOfBirth && form.dateOfBirth) data.dateOfBirth = form.dateOfBirth;
        if (!party.address?.line1 || !party.address?.state || !party.address?.postalCode) {
          data.address = {
            line1: form.line1 || party.address?.line1 || null,
            state: form.state || party.address?.state || null,
            postalCode: form.postalCode || party.address?.postalCode || null,
          };
        }
        if (party.isShareholder) {
          if (!party.shareType && form.shareType) data.shareType = form.shareType;
          if (!party.shareholdingUnits && form.shareholdingUnits) data.shareholdingUnits = form.shareholdingUnits;
          if (!party.shareholdingAmount && form.shareholdingAmount) data.shareholdingAmount = form.shareholdingAmount;
          if (!party.shareholdingPercentage && form.shareholdingPercentage) {
            data.shareholdingPercentage = form.shareholdingPercentage;
          }
        }
        if (party.isDirector || party.isBoard || party.isManagement) {
          if (!party.designation && form.designation) data.designation = form.designation;
          if (!party.appointmentDate && form.appointmentDate) data.appointmentDate = form.appointmentDate;
        }
        await save.mutateAsync(data);
      }}
    >
      {!party.gender ? (
        <SelectField
          label="Gender"
          value={form.gender}
          onChange={(value) => setForm({ ...form, gender: value })}
          options={SC_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
        />
      ) : null}
      {!party.nationality ? (
        <TextField
          label="Nationality"
          value={form.nationality}
          onChange={(value) => setForm({ ...form, nationality: value })}
        />
      ) : null}
      {!party.dateOfBirth ? (
        <DateField
          label="Date of birth"
          value={form.dateOfBirth}
          onChange={(value) => setForm({ ...form, dateOfBirth: value })}
        />
      ) : null}
      {!party.address?.line1 ? (
        <TextField label="Address" value={form.line1} onChange={(value) => setForm({ ...form, line1: value })} />
      ) : null}
      {!party.address?.state ? (
        <SelectField
          label="State"
          value={form.state}
          onChange={(value) => setForm({ ...form, state: value })}
          options={SC_MALAYSIAN_STATES.map((state) => ({ value: state, label: state }))}
        />
      ) : null}
      {!party.address?.postalCode ? (
        <TextField
          label="Postcode"
          value={form.postalCode}
          onChange={(value) => setForm({ ...form, postalCode: value })}
        />
      ) : null}
      {party.isShareholder && !party.shareType ? (
        <SelectField
          label="Type of shares"
          value={form.shareType}
          onChange={(value) => setForm({ ...form, shareType: value })}
          options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
        />
      ) : null}
      {party.isShareholder && !party.shareholdingUnits ? (
        <TextField
          label="Shareholding units"
          value={form.shareholdingUnits}
          onChange={(value) => setForm({ ...form, shareholdingUnits: value })}
        />
      ) : null}
      {party.isShareholder && !party.shareholdingAmount ? (
        <TextField
          label="Shareholding amount"
          value={form.shareholdingAmount}
          onChange={(value) => setForm({ ...form, shareholdingAmount: value })}
        />
      ) : null}
      {party.isShareholder && !party.shareholdingPercentage ? (
        <TextField
          label="Shareholding percentage"
          value={form.shareholdingPercentage}
          onChange={(value) => setForm({ ...form, shareholdingPercentage: value })}
        />
      ) : null}
      {(party.isDirector || party.isBoard || party.isManagement) && !party.designation ? (
        <SelectField
          label="Designation"
          value={form.designation}
          onChange={(value) => setForm({ ...form, designation: value })}
          options={SC_DESIGNATIONS.map((key) => ({ value: key, label: SC_DESIGNATION_LABELS[key] }))}
        />
      ) : null}
      {(party.isDirector || party.isBoard || party.isManagement) && !party.appointmentDate ? (
        <DateField
          label="Appointment date"
          value={form.appointmentDate}
          onChange={(value) => setForm({ ...form, appointmentDate: value })}
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

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
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
