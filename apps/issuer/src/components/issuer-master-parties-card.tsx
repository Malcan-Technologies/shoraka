"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
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
import { formInputDisabledClassName } from "@/app/(application-flow)/applications/components/form-control";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <Input value={value || "—"} disabled className={formInputDisabledClassName} />
    </div>
  );
}

function PartyFields({ party }: { party: OrganizationPartyProfileDto }) {
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
  const roles = [
    party.isDirector ? "Director" : null,
    party.isShareholder ? "Shareholder" : null,
    party.isBoard ? "Board" : null,
    party.isManagement ? "Management" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <p className="text-ui font-medium">
        {party.name || party.partyKey}
        {roles.length > 0 ? ` · ${roles.join(" · ")}` : ""}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ReadField label="Identity prefix" value={prefix || "—"} />
        <ReadField label="Identity number" value={party.identityNumber || "—"} />
        <ReadField label="Gender" value={gender || "—"} />
        <ReadField label="Nationality" value={party.nationality || "—"} />
        <ReadField label="Date of birth" value={formatDate(party.dateOfBirth)} />
        <ReadField label="Date of incorporation" value={formatDate(party.dateOfIncorporation)} />
        <ReadField label="Address" value={party.address?.line1 || "—"} />
        <ReadField label="State" value={party.address?.state || "—"} />
        <ReadField label="Postcode" value={party.address?.postalCode || "—"} />
        {party.isShareholder ? (
          <>
            <ReadField label="Type of shares" value={shareType || "—"} />
            {party.shareType === "OTHERS" ? (
              <ReadField label="Type of shares — others" value={party.shareTypeOther || "—"} />
            ) : null}
            <ReadField label="Shareholding units" value={party.shareholdingUnits || "—"} />
            <ReadField label="Shareholding amount" value={party.shareholdingAmount || "—"} />
            <ReadField label="Shareholding percentage" value={party.shareholdingPercentage || "—"} />
          </>
        ) : null}
        {party.isBoard || party.isManagement || party.isDirector ? (
          <>
            <ReadField label="Designation" value={designation || "—"} />
            {party.designation === "OTHERS" ? (
              <ReadField label="Designation — others" value={party.designationOther || "—"} />
            ) : null}
            <ReadField label="Appointment date" value={formatDate(party.appointmentDate)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

export function IssuerMasterPartiesCard({
  organizationId,
  onPartyChanged,
}: {
  organizationId: string;
  onPartyChanged?: () => void | Promise<void>;
}) {
  const { getAccessToken } = useAuthToken();
  const api = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["issuer", "party-profiles", organizationId],
    queryFn: async () => {
      const res = await api.getPartyProfiles("issuer", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data.filter((p) => p.membershipStatus === "MASTER_ACTIVE");
    },
  });

  const parties = query.data ?? [];

  return (
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">Shareholders, directors, board and management</h2>
        <p className="text-sm text-muted-foreground">
          CashSouk master list. Add people your company has appointed even if CTOS has not caught up.
          KYC onboarding for eligible directors and shareholders stays in the section below.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {query.isLoading ? <p className="text-ui text-muted-foreground">Loading…</p> : null}
        {!query.isLoading && parties.length === 0 ? (
          <p className="text-ui text-muted-foreground">No master parties stored yet.</p>
        ) : null}
        {parties.map((party) => (
          <PartyFields key={party.id} party={party} />
        ))}
        <AddPersonForm
          onSave={async (data) => {
            const res = await api.createManagementParty("issuer", organizationId, data);
            if (!res.success) throw new Error(res.error.message);
            toast.success("Person added");
            await queryClient.invalidateQueries({ queryKey: ["issuer", "party-profiles", organizationId] });
            await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", organizationId] });
            await onPartyChanged?.();
          }}
        />
      </div>
    </div>
  );
}

function AddPersonForm({
  onSave,
}: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
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

  const reset = () => {
    setEntityType("INDIVIDUAL");
    setIsDirector(false);
    setIsShareholder(false);
    setIsBoard(false);
    setIsManagement(false);
    setForm({
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
  };

  if (!open) {
    return (
      <Button className="h-10" variant="outline" type="button" onClick={() => setOpen(true)}>
        Add person
      </Button>
    );
  }

  const corporate = entityType === "CORPORATE";
  const showShare = corporate || isShareholder;
  const showOfficer = !corporate && (isDirector || isBoard || isManagement);

  return (
    <form
      className="grid gap-4 rounded-xl border border-dashed p-6 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
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
              ? {
                  line1: form.line1 || null,
                  state: form.state || null,
                  postalCode: form.postalCode || null,
                }
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
        reset();
        setOpen(false);
      }}
    >
      <p className="text-ui font-medium sm:col-span-2">Add a person or company</p>
      <div className="space-y-2">
        <Label className="text-ui">Person / entity type</Label>
        <Select
          value={entityType}
          onValueChange={(v) => {
            const next = v as "INDIVIDUAL" | "CORPORATE";
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
              <RoleCheck label="Management team" checked={isManagement} onChange={setIsManagement} />
            </>
          )}
        </div>
      </div>
      <TextField
        label={corporate ? "Company name" : "Name"}
        value={form.name}
        onChange={(v) => setForm({ ...form, name: v })}
      />
      {corporate ? (
        <TextField
          label="ROC / registration number"
          value={form.identityNumber}
          onChange={(v) => setForm({ ...form, identityNumber: v })}
        />
      ) : (
        <>
          <SelectField
            label="Identity prefix"
            value={form.identityPrefix}
            onChange={(v) => setForm({ ...form, identityPrefix: v })}
            options={SC_IDENTITY_PREFIXES.filter((k) => k !== "ROC").map((k) => ({
              value: k,
              label: SC_IDENTITY_PREFIX_LABELS[k],
            }))}
          />
          <TextField
            label="NRIC / passport"
            value={form.identityNumber}
            onChange={(v) => setForm({ ...form, identityNumber: v })}
          />
          <TextField
            label="Email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <DateField
            label="Date of birth"
            value={form.dateOfBirth}
            onChange={(v) => setForm({ ...form, dateOfBirth: v })}
          />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(v) => setForm({ ...form, gender: v })}
            options={SC_GENDERS.map((k) => ({ value: k, label: SC_GENDER_LABELS[k] }))}
          />
          <TextField
            label="Nationality"
            value={form.nationality}
            onChange={(v) => setForm({ ...form, nationality: v })}
          />
        </>
      )}
      {corporate ? (
        <>
          <DateField
            label="Date of incorporation"
            value={form.dateOfIncorporation}
            onChange={(v) => setForm({ ...form, dateOfIncorporation: v })}
          />
          <TextField
            label="Country of incorporation"
            value={form.countryOfIncorporation}
            onChange={(v) => setForm({ ...form, countryOfIncorporation: v })}
          />
        </>
      ) : null}
      <TextField
        label={corporate ? "Business address" : "Address"}
        value={form.line1}
        onChange={(v) => setForm({ ...form, line1: v })}
      />
      <SelectField
        label="State"
        value={form.state}
        onChange={(v) => setForm({ ...form, state: v })}
        options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))}
      />
      <TextField
        label="Postcode"
        value={form.postalCode}
        onChange={(v) => setForm({ ...form, postalCode: v })}
      />
      {showShare ? (
        <>
          <SelectField
            label="Type of shares"
            value={form.shareType}
            onChange={(v) => setForm({ ...form, shareType: v })}
            options={SC_SHARE_TYPES.map((k) => ({ value: k, label: SC_SHARE_TYPE_LABELS[k] }))}
          />
          {form.shareType === "OTHERS" ? (
            <TextField
              label="Type of shares — others"
              value={form.shareTypeOther}
              onChange={(v) => setForm({ ...form, shareTypeOther: v })}
            />
          ) : null}
          <TextField
            label="Shareholding units"
            value={form.shareholdingUnits}
            onChange={(v) => setForm({ ...form, shareholdingUnits: v })}
          />
          <TextField
            label="Shareholding amount"
            value={form.shareholdingAmount}
            onChange={(v) => setForm({ ...form, shareholdingAmount: v })}
          />
          <TextField
            label="Shareholding percentage"
            value={form.shareholdingPercentage}
            onChange={(v) => setForm({ ...form, shareholdingPercentage: v })}
          />
        </>
      ) : null}
      {showOfficer ? (
        <>
          <SelectField
            label="Designation"
            value={form.designation}
            onChange={(v) => setForm({ ...form, designation: v })}
            options={SC_DESIGNATIONS.map((k) => ({ value: k, label: SC_DESIGNATION_LABELS[k] }))}
          />
          {form.designation === "OTHERS" ? (
            <TextField
              label="Designation — others"
              value={form.designationOther}
              onChange={(v) => setForm({ ...form, designationOther: v })}
            />
          ) : null}
          <DateField
            label="Appointment date"
            value={form.appointmentDate}
            onChange={(v) => setForm({ ...form, appointmentDate: v })}
          />
        </>
      ) : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" className="h-10" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save person"}
        </Button>
        <Button
          type="button"
          className="h-10"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
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
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
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
  onChange: (v: string) => void;
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
