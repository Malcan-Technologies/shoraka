"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  firstIssueMessage,
  humanizeApiValidationMessage,
  isProfileValidationError,
  issuesByField,
  issuerShareholdingThresholdIssue,
  formatPartyRoleLine,
  isIssuerOfficerRole,
  monthlyIssuerPersonCopy,
  PROFILE_LOCKED_ROLES_CANNOT_CHANGE,
  PERSON_EMAIL_HELP,
  restrictScIdentityInput,
  restrictScPostcodeInput,
  SELECT_AT_LEAST_ONE_ROLE_MESSAGE,
  SC_DESIGNATION_LABELS,
  SC_DESIGNATIONS,
  SC_GENDER_LABELS,
  SC_INDIVIDUAL_GENDERS,
  SC_IDENTITY_PREFIXES,
  SC_MALAYSIAN_STATES,
  SC_MONTHLY_BOARD,
  SC_MONTHLY_ISSUER,
  SC_MONTHLY_PERSON_KIND_LABELS,
  SC_MONTHLY_SHAREHOLDER,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
  scAppendixASelectValues,
  validateIssuerPersonForm,
  type OrganizationPartyProfileDto,
} from "@cashsouk/types";
import { ComRepFieldLabel } from "./comrep-field-label";
import { PartyProfileDetailFields } from "./party-profile-detail-fields";
import { ProfileReadField } from "./components/profile-read-field";
import { Button } from "./components/button";
import { Checkbox } from "./components/checkbox";
import { Input } from "./components/input";
import { Label } from "./components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/select";

export function PartyDetailFields({
  party,
  person,
}: {
  party: OrganizationPartyProfileDto;
  person?: import("@cashsouk/types").ApplicationPersonRow | null;
}) {
  return <PartyProfileDetailFields party={party} person={person ?? null} />;
}

export type AddPersonInitial = {
  name?: string;
  identityNumber?: string;
  email?: string;
  entityType?: "INDIVIDUAL" | "CORPORATE";
  isDirector?: boolean;
  isShareholder?: boolean;
  isBoard?: boolean;
  isManagement?: boolean;
  shareholdingPercentage?: string;
};

export function AddPersonForm({
  onSave,
  onCancel,
  initial,
}: {
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  initial?: AddPersonInitial | null;
}) {
  const [entityType, setEntityType] = React.useState<"INDIVIDUAL" | "CORPORATE">(
    initial?.entityType ?? "INDIVIDUAL"
  );
  const [isDirector, setIsDirector] = React.useState(Boolean(initial?.isDirector));
  const [isShareholder, setIsShareholder] = React.useState(Boolean(initial?.isShareholder));
  const [isBoard, setIsBoard] = React.useState(Boolean(initial?.isBoard));
  const [isManagement, setIsManagement] = React.useState(Boolean(initial?.isManagement));
  const [form, setForm] = React.useState({
    name: initial?.name ?? "",
    salutation: "",
    identityPrefix: initial?.entityType === "CORPORATE" ? "ROC" : "NRIC",
    identityNumber: initial?.identityNumber ?? "",
    email: initial?.email ?? "",
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
    shareholdingPercentage: initial?.shareholdingPercentage ?? "",
    designation: "",
    designationOther: "",
    appointmentDate: "",
    resignationDate: "",
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const corporate = entityType === "CORPORATE";
  const showShare = corporate || isShareholder;
  const showOfficer = !corporate && isIssuerOfficerRole({ isBoard, isManagement });
  const copy = monthlyIssuerPersonCopy({ shareholder: showShare, officer: showOfficer });
  const prefixOptions = SC_IDENTITY_PREFIXES.filter((key) => copy.includeRocPrefix || key !== "ROC");

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!corporate && !isDirector && !isShareholder && !isBoard && !isManagement) {
          toast.error(SELECT_AT_LEAST_ONE_ROLE_MESSAGE);
          return;
        }
        const officer = isIssuerOfficerRole({ isBoard, isManagement });
        const issues = validateIssuerPersonForm({
          entityType,
          name: form.name,
          identityPrefix: corporate ? "ROC" : form.identityPrefix,
          identityNumber: form.identityNumber,
          email: form.email,
          dateOfBirth: form.dateOfBirth,
          dateOfIncorporation: form.dateOfIncorporation,
          gender: form.gender,
          nationality: form.nationality,
          countryOfIncorporation: form.countryOfIncorporation,
          line1: form.line1,
          state: form.state,
          postalCode: form.postalCode,
          isShareholder: corporate || isShareholder,
          isOfficer: !corporate && officer,
          shareType: form.shareType,
          shareTypeOther: form.shareTypeOther,
          shareholdingUnits: form.shareholdingUnits,
          shareholdingAmount: form.shareholdingAmount,
          shareholdingPercentage: form.shareholdingPercentage,
          designation: form.designation,
          designationOther: form.designationOther,
          appointmentDate: form.appointmentDate,
        });
        if (corporate || isShareholder) {
          const shareIssue = issuerShareholdingThresholdIssue(form.shareholdingPercentage, {
            required: true,
          });
          if (shareIssue) issues.push(shareIssue);
        }
        if (issues.length > 0) {
          setFieldErrors(issuesByField(issues));
          toast.error(firstIssueMessage(issues));
          return;
        }
        setFieldErrors({});
        setPending(true);
        try {
          await onSave({
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
        } catch (err) {
          if (isProfileValidationError(err)) setFieldErrors(err.fieldErrors);
          toast.error(
            err instanceof Error ? humanizeApiValidationMessage(err.message) : "Could not save this person."
          );
        } finally {
          setPending(false);
        }
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
              setForm((current) => ({
                ...current,
                identityPrefix: "ROC",
                identityNumber: restrictScIdentityInput("ROC", current.identityNumber),
              }));
            } else {
              setForm((current) => ({
                ...current,
                identityPrefix: current.identityPrefix === "ROC" ? "NRIC" : current.identityPrefix,
                identityNumber: restrictScIdentityInput(
                  current.identityPrefix === "PASSPORT" ? "PASSPORT" : "NRIC",
                  current.identityNumber
                ),
              }));
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
        error={fieldErrors.name}
      />
      {!corporate ? (
        <TextField
          label={copy.salutation.label}
          value={form.salutation}
          onChange={(value) => setForm({ ...form, salutation: value })}
          help={copy.salutation.help}
        />
      ) : null}
      {corporate ? (
        <TextField
          label={copy.identity.label}
          value={form.identityNumber}
          onChange={(value) =>
            setForm({ ...form, identityNumber: restrictScIdentityInput("ROC", value) })
          }
          required
          help={copy.identity.help}
          error={fieldErrors.identityNumber}
          maxLength={500}
        />
      ) : (
        <>
          <SelectField
            label={copy.identityPrefix.label}
            value={form.identityPrefix}
            onChange={(value) =>
              setForm({
                ...form,
                identityPrefix: value,
                identityNumber: restrictScIdentityInput(
                  value === "PASSPORT" ? "PASSPORT" : "NRIC",
                  form.identityNumber
                ),
              })
            }
            options={prefixOptions.map((key) => ({
              value: key,
              label: copy.identityPrefixLabels[key as keyof typeof copy.identityPrefixLabels] ?? key,
            }))}
            required
            error={fieldErrors.identityPrefix}
          />
          <TextField
            label={copy.identity.label}
            value={form.identityNumber}
            onChange={(value) =>
              setForm({
                ...form,
                identityNumber: restrictScIdentityInput(
                  form.identityPrefix === "PASSPORT" ? "PASSPORT" : "NRIC",
                  value
                ),
              })
            }
            required
            help={copy.identity.help}
            error={fieldErrors.identityNumber}
            maxLength={500}
          />
          <TextField
            label="Email"
            value={form.email}
            onChange={(value) => setForm({ ...form, email: value })}
            help={PERSON_EMAIL_HELP}
            error={fieldErrors.email}
            maxLength={255}
            inputMode="email"
          />
          <DateField
            label={copy.dateOfBirth.label}
            value={form.dateOfBirth}
            onChange={(value) => setForm({ ...form, dateOfBirth: value })}
            help={copy.dateOfBirth.help}
            required
            error={fieldErrors.dateOfBirth}
          />
          <SelectField
            label={copy.gender.label}
            value={form.gender}
            onChange={(value) => setForm({ ...form, gender: value })}
            options={SC_INDIVIDUAL_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
            help={copy.gender.help}
            required
            error={fieldErrors.gender}
          />
          <CountryField
            label={copy.nationality.label}
            value={form.nationality}
            onChange={(value) => setForm({ ...form, nationality: value })}
            help={copy.nationality.help}
            required
            error={fieldErrors.nationality}
          />
        </>
      )}
      {corporate ? (
        <>
          <DateField
            label={SC_MONTHLY_ISSUER.dateOfIncorporation.label}
            value={form.dateOfIncorporation}
            onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
            required
            error={fieldErrors.dateOfIncorporation}
          />
          <CountryField
            label={copy.nationality.label}
            value={form.countryOfIncorporation}
            onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
            help={copy.nationality.help}
            required
            error={fieldErrors.countryOfIncorporation}
          />
        </>
      ) : null}
      <TextField
        label={copy.address.label}
        value={form.line1}
        onChange={(value) => setForm({ ...form, line1: value })}
        required
        error={fieldErrors["address.line1"]}
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
        required
        error={fieldErrors["address.state"]}
      />
      <TextField
        label={copy.addressPostcode.label}
        value={form.postalCode}
        onChange={(value) =>
          setForm({ ...form, postalCode: restrictScPostcodeInput(form.state, value) })
        }
        help={copy.addressPostcode.help}
        required={form.state !== "Outside Malaysia"}
        error={fieldErrors["address.postalCode"]}
        inputMode={form.state === "Outside Malaysia" ? undefined : "numeric"}
        maxLength={form.state === "Outside Malaysia" ? 500 : 32}
      />
      {showShare ? (
        <>
          <SelectField
            label={SC_MONTHLY_SHAREHOLDER.typeOfShares.label}
            value={form.shareType}
            onChange={(value) => setForm({ ...form, shareType: value })}
            options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
            required
            error={fieldErrors.shareType}
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
            onChange={(value) => setForm({ ...form, shareholdingUnits: restrictShareInput(value) })}
            required
            error={fieldErrors.shareholdingUnits}
            inputMode="decimal"
          />
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label}
            value={form.shareholdingAmount}
            onChange={(value) => setForm({ ...form, shareholdingAmount: restrictShareInput(value) })}
            required
            error={fieldErrors.shareholdingAmount}
            inputMode="decimal"
          />
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label}
            value={form.shareholdingPercentage}
            onChange={(value) =>
              setForm({ ...form, shareholdingPercentage: restrictShareInput(value) })
            }
            required
            error={fieldErrors.shareholdingPercentage}
            inputMode="decimal"
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
            required
            error={fieldErrors.designation}
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
            required
            error={fieldErrors.appointmentDate}
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
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Saving…" : "Save person"}
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
  const [pending, setPending] = React.useState(false);
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
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const officer = isIssuerOfficerRole(party);
  const corporate = party.entityType === "CORPORATE";
  const copy = monthlyIssuerPersonCopy({ shareholder: party.isShareholder, officer });
  const identityLocked =
    copy.identityPrefixLabels[party.identityPrefix as keyof typeof copy.identityPrefixLabels] ??
    party.identityPrefix;

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const issues = validateIssuerPersonForm({
          entityType: party.entityType,
          name: party.name,
          identityPrefix: party.identityPrefix,
          identityNumber: party.identityNumber,
          dateOfBirth: form.dateOfBirth || party.dateOfBirth,
          dateOfIncorporation: form.dateOfIncorporation || party.dateOfIncorporation,
          gender: form.gender || party.gender,
          nationality: form.nationality || party.nationality,
          countryOfIncorporation: form.countryOfIncorporation || party.countryOfIncorporation,
          line1: form.line1,
          state: form.state,
          postalCode: form.postalCode,
          isShareholder: party.isShareholder,
          isOfficer: officer,
          shareType: form.shareType,
          shareTypeOther: form.shareTypeOther,
          shareholdingUnits: form.shareholdingUnits,
          shareholdingAmount: form.shareholdingAmount,
          shareholdingPercentage: form.shareholdingPercentage,
          designation: form.designation,
          designationOther: form.designationOther,
          appointmentDate: form.appointmentDate,
        });
        if (party.isShareholder) {
          const shareIssue = issuerShareholdingThresholdIssue(form.shareholdingPercentage, {
            required: true,
          });
          if (shareIssue) issues.push(shareIssue);
        }
        if (issues.length > 0) {
          setFieldErrors(issuesByField(issues));
          toast.error(firstIssueMessage(issues));
          return;
        }
        setFieldErrors({});
        const data: Record<string, unknown> = {
          address: {
            line1: form.line1 || null,
            line2: form.line2 || null,
            state: form.state || null,
            postalCode: form.postalCode || null,
          },
        };
        if (!party.salutation && form.salutation) data.salutation = form.salutation;
        if (corporate && party.gender !== "NOT_APPLICABLE") {
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
        if (party.isShareholder) {
          data.shareType = form.shareType || null;
          data.shareTypeOther = form.shareType === "OTHERS" ? form.shareTypeOther || null : null;
          data.shareholdingUnits = form.shareholdingUnits || null;
          data.shareholdingAmount = form.shareholdingAmount || null;
          data.shareholdingPercentage = form.shareholdingPercentage || null;
        }
        if (officer) {
          data.designation = form.designation || null;
          data.designationOther = form.designation === "OTHERS" ? form.designationOther || null : null;
          data.appointmentDate = form.appointmentDate || null;
          data.resignationDate = form.resignationDate || null;
        }
        setPending(true);
        try {
          await onSave(data);
        } catch (err) {
          if (isProfileValidationError(err)) setFieldErrors(err.fieldErrors);
          toast.error(
            err instanceof Error ? humanizeApiValidationMessage(err.message) : "Could not save this person."
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <ProfileReadField label={copy.name.label} value={party.name} locked help={copy.name.help} />
      <ProfileReadField
        label={copy.identity.label}
        value={[identityLocked, party.identityNumber].filter(Boolean).join(" ")}
        locked
        help={copy.identity.help}
      />
      <ProfileReadField label="Roles" value={formatPartyRoleLine(party)} locked lockReason={PROFILE_LOCKED_ROLES_CANNOT_CHANGE} />
      {!corporate && !party.salutation ? (
        <TextField
          label={copy.salutation.label}
          value={form.salutation}
          onChange={(value) => setForm({ ...form, salutation: value })}
          help={copy.salutation.help}
        />
      ) : null}
      {!corporate && !party.gender ? (
        <SelectField
          label={copy.gender.label}
          value={form.gender}
          onChange={(value) => setForm({ ...form, gender: value })}
          options={SC_INDIVIDUAL_GENDERS.map((key) => ({ value: key, label: SC_GENDER_LABELS[key] }))}
          help={copy.gender.help}
          required
          error={fieldErrors.gender}
        />
      ) : !corporate && party.gender ? (
        <ProfileReadField
          label={copy.gender.label}
          value={SC_GENDER_LABELS[party.gender as keyof typeof SC_GENDER_LABELS] ?? party.gender}
          locked
        />
      ) : null}
      {!corporate && !party.nationality ? (
        <CountryField
          label={copy.nationality.label}
          value={form.nationality}
          onChange={(value) => setForm({ ...form, nationality: value })}
          help={copy.nationality.help}
          required
          error={fieldErrors.nationality}
        />
      ) : !corporate && party.nationality ? (
        <ProfileReadField label={copy.nationality.label} value={party.nationality} locked />
      ) : null}
      {!corporate && !party.dateOfBirth ? (
        <DateField
          label={copy.dateOfBirth.label}
          value={form.dateOfBirth}
          onChange={(value) => setForm({ ...form, dateOfBirth: value })}
          help={copy.dateOfBirth.help}
          required
          error={fieldErrors.dateOfBirth}
        />
      ) : !corporate && party.dateOfBirth ? (
        <ProfileReadField
          label={copy.dateOfBirth.label}
          value={party.dateOfBirth.slice(0, 10)}
          locked
          help={copy.dateOfBirth.help}
        />
      ) : null}
      {corporate && !party.dateOfIncorporation ? (
        <DateField
          label={SC_MONTHLY_ISSUER.dateOfIncorporation.label}
          value={form.dateOfIncorporation}
          onChange={(value) => setForm({ ...form, dateOfIncorporation: value })}
          required
          error={fieldErrors.dateOfIncorporation}
        />
      ) : corporate && party.dateOfIncorporation ? (
        <ProfileReadField
          label={SC_MONTHLY_ISSUER.dateOfIncorporation.label}
          value={party.dateOfIncorporation.slice(0, 10)}
          locked
        />
      ) : null}
      {corporate && !party.countryOfIncorporation ? (
        <CountryField
          label={copy.nationality.label}
          value={form.countryOfIncorporation}
          onChange={(value) => setForm({ ...form, countryOfIncorporation: value })}
          help={copy.nationality.help}
          required
          error={fieldErrors.countryOfIncorporation}
        />
      ) : corporate && party.countryOfIncorporation ? (
        <ProfileReadField label={copy.nationality.label} value={party.countryOfIncorporation} locked />
      ) : null}
      <TextField
        label={copy.address.label}
        value={form.line1}
        onChange={(value) => setForm({ ...form, line1: value })}
        required
        error={fieldErrors["address.line1"]}
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
        required
        error={fieldErrors["address.state"]}
      />
      <TextField
        label={copy.addressPostcode.label}
        value={form.postalCode}
        onChange={(value) =>
          setForm({ ...form, postalCode: restrictScPostcodeInput(form.state, value) })
        }
        help={copy.addressPostcode.help}
        required={form.state !== "Outside Malaysia"}
        error={fieldErrors["address.postalCode"]}
        inputMode={form.state === "Outside Malaysia" ? undefined : "numeric"}
        maxLength={form.state === "Outside Malaysia" ? 500 : 32}
      />
      {party.isShareholder ? (
        <>
          <SelectField
            label={SC_MONTHLY_SHAREHOLDER.typeOfShares.label}
            value={form.shareType}
            onChange={(value) => setForm({ ...form, shareType: value })}
            options={SC_SHARE_TYPES.map((key) => ({ value: key, label: SC_SHARE_TYPE_LABELS[key] }))}
            required
            error={fieldErrors.shareType}
          />
          {form.shareType === "OTHERS" ? (
            <TextField
              label={SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label}
              value={form.shareTypeOther}
              onChange={(value) => setForm({ ...form, shareTypeOther: value })}
              required
              error={fieldErrors.shareTypeOther}
            />
          ) : null}
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label}
            value={form.shareholdingUnits}
            onChange={(value) => setForm({ ...form, shareholdingUnits: restrictShareInput(value) })}
            required
            error={fieldErrors.shareholdingUnits}
            inputMode="decimal"
          />
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label}
            value={form.shareholdingAmount}
            onChange={(value) => setForm({ ...form, shareholdingAmount: restrictShareInput(value) })}
            required
            error={fieldErrors.shareholdingAmount}
            inputMode="decimal"
          />
          <TextField
            label={SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label}
            value={form.shareholdingPercentage}
            onChange={(value) =>
              setForm({ ...form, shareholdingPercentage: restrictShareInput(value) })
            }
            required
            error={fieldErrors.shareholdingPercentage}
            inputMode="decimal"
          />
        </>
      ) : null}
      {officer ? (
        <>
          <SelectField
            label={SC_MONTHLY_BOARD.designation.label}
            value={form.designation}
            onChange={(value) => setForm({ ...form, designation: value })}
            options={SC_DESIGNATIONS.map((key) => ({ value: key, label: SC_DESIGNATION_LABELS[key] }))}
            required
            error={fieldErrors.designation}
          />
          {form.designation === "OTHERS" ? (
            <TextField
              label={SC_MONTHLY_BOARD.designationOthers.label}
              value={form.designationOther}
              onChange={(value) => setForm({ ...form, designationOther: value })}
              required
              help={SC_MONTHLY_BOARD.designationOthers.help}
              error={fieldErrors.designationOther}
            />
          ) : null}
          <DateField
            label={SC_MONTHLY_BOARD.appointmentDate.label}
            value={form.appointmentDate}
            onChange={(value) => setForm({ ...form, appointmentDate: value })}
            required
            error={fieldErrors.appointmentDate}
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
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Saving…" : "Save"}
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

function restrictShareInput(value: string): string {
  return value.replace(/[^\d.]/g, "");
}

function TextField({
  label,
  value,
  onChange,
  help,
  required = false,
  error,
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "email" | "tel" | "text";
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input
        className="h-10 text-ui"
        value={value}
        maxLength={maxLength ?? 500}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <p className="text-meta text-destructive">{error}</p>
      ) : required && !value.trim() ? (
        <p className="text-meta text-status-action-text">Required</p>
      ) : null}
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  help,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input className="h-10 text-ui" type="date" value={value} onChange={(event) => onChange(event.target.value)} />
      {error ? (
        <p className="text-meta text-destructive">{error}</p>
      ) : required && !value.trim() ? (
        <p className="text-meta text-status-action-text">Required</p>
      ) : null}
    </div>
  );
}

function CountryField({
  label,
  value,
  onChange,
  help,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <SelectField
      label={label}
      value={value}
      onChange={onChange}
      options={scAppendixASelectValues(value).map((country) => ({ value: country, label: country }))}
      help={help}
      required={required}
      error={error}
    />
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  help,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  help?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p className="text-meta text-destructive">{error}</p>
      ) : required && !value.trim() ? (
        <p className="text-meta text-status-action-text">Required</p>
      ) : null}
    </div>
  );
}
