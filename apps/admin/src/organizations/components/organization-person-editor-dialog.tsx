"use client";

import * as React from "react";
import { toast } from "sonner";
import type { ApplicationPersonRow, OrganizationPartyProfileDto } from "@cashsouk/types";
import {
  firstIssueMessage,
  isIssuerOfficerRole,
  isProfileValidationError,
  issuerShareholdingThresholdIssue,
  issuesByField,
  monthlyIssuerPersonCopy,
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
} from "@cashsouk/types";
import { ComRepFieldLabel } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PartyEditorValues = {
  name: string;
  salutation: string;
  identityPrefix: string;
  identityNumber: string;
  entityType: "INDIVIDUAL" | "CORPORATE";
  isDirector: boolean;
  isShareholder: boolean;
  isBoard: boolean;
  isManagement: boolean;
  gender: string;
  nationality: string;
  countryOfIncorporation: string;
  dateOfBirth: string;
  dateOfIncorporation: string;
  line1: string;
  line2: string;
  state: string;
  postalCode: string;
  shareholdingPercentage: string;
  shareType: string;
  shareTypeOther: string;
  shareholdingUnits: string;
  shareholdingAmount: string;
  designation: string;
  designationOther: string;
  appointmentDate: string;
  resignationDate: string;
};

const emptyValues: PartyEditorValues = {
  name: "",
  salutation: "",
  identityPrefix: "NRIC",
  identityNumber: "",
  entityType: "INDIVIDUAL",
  isDirector: false,
  isShareholder: false,
  isBoard: false,
  isManagement: false,
  gender: "",
  nationality: "",
  countryOfIncorporation: "",
  dateOfBirth: "",
  dateOfIncorporation: "",
  line1: "",
  line2: "",
  state: "",
  postalCode: "",
  shareholdingPercentage: "",
  shareType: "ORDINARY",
  shareTypeOther: "",
  shareholdingUnits: "",
  shareholdingAmount: "",
  designation: "",
  designationOther: "",
  appointmentDate: "",
  resignationDate: "",
};

export function partyToEditorValues(party: OrganizationPartyProfileDto): PartyEditorValues {
  return {
    name: party.name ?? "",
    salutation: party.salutation ?? "",
    identityPrefix: party.identityPrefix ?? "",
    identityNumber: party.identityNumber ?? "",
    entityType: party.entityType,
    isDirector: party.isDirector,
    isShareholder: party.isShareholder,
    isBoard: party.isBoard,
    isManagement: party.isManagement,
    gender: party.gender ?? "",
    nationality: party.nationality ?? "",
    countryOfIncorporation: party.countryOfIncorporation ?? "",
    dateOfBirth: party.dateOfBirth?.slice(0, 10) ?? "",
    dateOfIncorporation: party.dateOfIncorporation?.slice(0, 10) ?? "",
    line1: party.address?.line1 ?? "",
    line2: party.address?.line2 ?? "",
    state: party.address?.state ?? "",
    postalCode: party.address?.postalCode ?? "",
    shareholdingPercentage: party.shareholdingPercentage ?? "",
    shareType: party.shareType ?? "",
    shareTypeOther: party.shareTypeOther ?? "",
    shareholdingUnits: party.shareholdingUnits ?? "",
    shareholdingAmount: party.shareholdingAmount ?? "",
    designation: party.designation ?? "",
    designationOther: party.designationOther ?? "",
    appointmentDate: party.appointmentDate?.slice(0, 10) ?? "",
    resignationDate: party.resignationDate?.slice(0, 10) ?? "",
  };
}

export function personToEditorValues(person: ApplicationPersonRow): PartyEditorValues {
  const roles = (person.roles ?? []).map((role) => role.toUpperCase());
  const corporate = person.entityType === "CORPORATE";
  return {
    ...emptyValues,
    name: person.name ?? "",
    identityNumber: person.matchKey ?? "",
    identityPrefix: corporate ? "ROC" : "NRIC",
    entityType: person.entityType,
    isDirector: roles.includes("DIRECTOR"),
    isShareholder: roles.includes("SHAREHOLDER"),
    isBoard: roles.includes("BOARD"),
    isManagement: roles.includes("MANAGEMENT"),
    shareholdingPercentage: person.sharePercentage != null ? String(person.sharePercentage) : "",
    shareType: roles.includes("SHAREHOLDER") ? "ORDINARY" : "",
  };
}

export function OrganizationPersonEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  initial,
  isSaving,
  onSave,
  enforceIssuerShareholderMinimum = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initial?: PartyEditorValues | null;
  isSaving: boolean;
  onSave: (values: PartyEditorValues) => Promise<void>;
  enforceIssuerShareholderMinimum?: boolean;
}) {
  const [values, setValues] = React.useState<PartyEditorValues>(initial ?? emptyValues);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setValues(initial ?? emptyValues);
      setFieldErrors({});
    }
  }, [open, initial]);

  const set = <K extends keyof PartyEditorValues>(key: K, value: PartyEditorValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };
  const corporate = values.entityType === "CORPORATE";
  const showShare = corporate || values.isShareholder;
  const showOfficer = !corporate && isIssuerOfficerRole(values);
  const copy = monthlyIssuerPersonCopy({ shareholder: showShare, officer: showOfficer });
  const prefixOptions = SC_IDENTITY_PREFIXES.filter((key) => copy.includeRocPrefix || key !== "ROC");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={copy.name.label}
            value={values.name}
            onChange={(name) => set("name", name)}
            required
            help={copy.name.help}
            error={fieldErrors.name}
            maxLength={500}
          />
          {!corporate ? (
            <Field
              label={copy.salutation.label}
              value={values.salutation}
              onChange={(salutation) => set("salutation", salutation)}
              help={copy.salutation.help}
            />
          ) : null}
          <div className="space-y-1.5">
            <ComRepFieldLabel
              label={showShare ? SC_MONTHLY_SHAREHOLDER.shareholderType.label : "Person / entity type"}
            />
            <Select
              value={values.entityType}
              onValueChange={(entityType: "INDIVIDUAL" | "CORPORATE") => {
                if (entityType === "CORPORATE") {
                  setValues((current) => ({
                    ...current,
                    entityType,
                    identityPrefix: "ROC",
                    identityNumber: restrictScIdentityInput("ROC", current.identityNumber),
                    isDirector: false,
                    isBoard: false,
                    isManagement: false,
                    isShareholder: true,
                    gender: "NOT_APPLICABLE",
                  }));
                  return;
                }
                setValues((current) => ({
                    ...current,
                    entityType,
                    identityPrefix: "NRIC",
                    identityNumber: restrictScIdentityInput("NRIC", current.identityNumber),
                    gender: current.gender === "NOT_APPLICABLE" ? "" : current.gender,
                    salutation: current.salutation,
                  }));
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
          {!corporate ? (
            <div className="space-y-1.5">
              <ComRepFieldLabel label={copy.identityPrefix.label} />
              <Select
                value={values.identityPrefix || undefined}
                onValueChange={(identityPrefix) => {
                  set("identityPrefix", identityPrefix);
                  set(
                    "identityNumber",
                    restrictScIdentityInput(
                      identityPrefix === "PASSPORT" ? "PASSPORT" : "NRIC",
                      values.identityNumber
                    )
                  );
                }}
              >
                <SelectTrigger className="h-10 text-ui">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {prefixOptions.map((prefix) => (
                    <SelectItem key={prefix} value={prefix}>
                      {copy.identityPrefixLabels[prefix as keyof typeof copy.identityPrefixLabels] ?? prefix}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <Field
            label={copy.identity.label}
            value={values.identityNumber}
            onChange={(identityNumber) =>
              set(
                "identityNumber",
                restrictScIdentityInput(
                  corporate ? "ROC" : values.identityPrefix === "PASSPORT" ? "PASSPORT" : "NRIC",
                  identityNumber
                )
              )
            }
            required
            help={copy.identity.help}
            error={fieldErrors.identityNumber}
            maxLength={500}
          />
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-ui">Roles</legend>
            {(
              [
                ["isDirector", "Director"],
                ["isBoard", SC_MONTHLY_PERSON_KIND_LABELS.BOARD],
                ["isManagement", SC_MONTHLY_PERSON_KIND_LABELS.MANAGEMENT],
                ["isShareholder", "Shareholder"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-ui">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={values[key]}
                  disabled={corporate && key !== "isShareholder"}
                  onChange={(event) => set(key, event.target.checked)}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {corporate ? (
            <>
              <Field
                type="date"
                label={SC_MONTHLY_ISSUER.dateOfIncorporation.label}
                value={values.dateOfIncorporation}
                onChange={(dateOfIncorporation) => set("dateOfIncorporation", dateOfIncorporation)}
                required
              />
              <div className="space-y-1.5">
                <ComRepFieldLabel label={copy.nationality.label} help={copy.nationality.help} required />
                <Select
                  value={values.countryOfIncorporation || undefined}
                  onValueChange={(countryOfIncorporation) => set("countryOfIncorporation", countryOfIncorporation)}
                >
                  <SelectTrigger className="h-10 text-ui">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {scAppendixASelectValues(values.countryOfIncorporation).map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <ComRepFieldLabel label={copy.gender.label} help={copy.gender.help} required />
                <Select value={values.gender || undefined} onValueChange={(gender) => set("gender", gender)}>
                  <SelectTrigger className="h-10 text-ui">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SC_INDIVIDUAL_GENDERS.map((gender) => (
                      <SelectItem key={gender} value={gender}>
                        {SC_GENDER_LABELS[gender]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field
                type="date"
                label={copy.dateOfBirth.label}
                value={values.dateOfBirth}
                onChange={(dateOfBirth) => set("dateOfBirth", dateOfBirth)}
                help={copy.dateOfBirth.help}
                required
              />
              <div className="space-y-1.5">
                <ComRepFieldLabel label={copy.nationality.label} help={copy.nationality.help} required />
                <Select
                  value={values.nationality || undefined}
                  onValueChange={(nationality) => set("nationality", nationality)}
                >
                  <SelectTrigger className="h-10 text-ui">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {scAppendixASelectValues(values.nationality).map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <Field
            label={copy.address.label}
            value={values.line1}
            onChange={(line1) => set("line1", line1)}
            required
            error={fieldErrors["address.line1"]}
            maxLength={500}
          />
          <Field
            label="Address line 2"
            value={values.line2}
            onChange={(line2) => set("line2", line2)}
            maxLength={500}
          />
          <div className="space-y-1.5">
            <ComRepFieldLabel label={copy.addressState.label} help={copy.addressState.help} required />
            <Select value={values.state || undefined} onValueChange={(state) => set("state", state)}>
              <SelectTrigger className="h-10 text-ui">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {SC_MALAYSIAN_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field
            label={copy.addressPostcode.label}
            value={values.postalCode}
            onChange={(postalCode) =>
              set("postalCode", restrictScPostcodeInput(values.state, postalCode))
            }
            help={copy.addressPostcode.help}
            required={values.state !== "Outside Malaysia"}
            error={fieldErrors["address.postalCode"]}
            inputMode={values.state === "Outside Malaysia" ? undefined : "numeric"}
            maxLength={values.state === "Outside Malaysia" ? 500 : 32}
          />
          {showShare ? (
            <>
              <div className="space-y-1.5">
                <ComRepFieldLabel label={SC_MONTHLY_SHAREHOLDER.typeOfShares.label} required />
                <Select value={values.shareType || undefined} onValueChange={(shareType) => set("shareType", shareType)}>
                  <SelectTrigger className="h-10 text-ui">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SC_SHARE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {SC_SHARE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {values.shareType === "OTHERS" ? (
                <Field
                  label={SC_MONTHLY_SHAREHOLDER.typeOfSharesOthers.label}
                  value={values.shareTypeOther}
                  onChange={(shareTypeOther) => set("shareTypeOther", shareTypeOther)}
                  required
                />
              ) : null}
              <Field
                label={SC_MONTHLY_SHAREHOLDER.shareholdingUnits.label}
                value={values.shareholdingUnits}
                onChange={(shareholdingUnits) =>
                  set("shareholdingUnits", shareholdingUnits.replace(/[^\d.]/g, ""))
                }
                required
                error={fieldErrors.shareholdingUnits}
                inputMode="decimal"
              />
              <Field
                label={SC_MONTHLY_SHAREHOLDER.shareholdingAmount.label}
                value={values.shareholdingAmount}
                onChange={(shareholdingAmount) =>
                  set("shareholdingAmount", shareholdingAmount.replace(/[^\d.]/g, ""))
                }
                required
                error={fieldErrors.shareholdingAmount}
                inputMode="decimal"
              />
              <Field
                label={SC_MONTHLY_SHAREHOLDER.shareholdingPercentage.label}
                value={values.shareholdingPercentage}
                onChange={(shareholdingPercentage) =>
                  set("shareholdingPercentage", shareholdingPercentage.replace(/[^\d.]/g, ""))
                }
                required
                error={fieldErrors.shareholdingPercentage}
                inputMode="decimal"
              />
            </>
          ) : null}
          {showOfficer ? (
            <>
              <div className="space-y-1.5">
                <ComRepFieldLabel label={SC_MONTHLY_BOARD.designation.label} required />
                <Select
                  value={values.designation || undefined}
                  onValueChange={(designation) => set("designation", designation)}
                >
                  <SelectTrigger className="h-10 text-ui">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SC_DESIGNATIONS.map((designation) => (
                      <SelectItem key={designation} value={designation}>
                        {SC_DESIGNATION_LABELS[designation]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {values.designation === "OTHERS" ? (
                <Field
                  label={SC_MONTHLY_BOARD.designationOthers.label}
                  value={values.designationOther}
                  onChange={(designationOther) => set("designationOther", designationOther)}
                  required
                  help={SC_MONTHLY_BOARD.designationOthers.help}
                />
              ) : null}
              <Field
                type="date"
                label={SC_MONTHLY_BOARD.appointmentDate.label}
                value={values.appointmentDate}
                onChange={(appointmentDate) => set("appointmentDate", appointmentDate)}
                required
              />
              <Field
                type="date"
                label={SC_MONTHLY_BOARD.resignationDate.label}
                value={values.resignationDate}
                onChange={(resignationDate) => set("resignationDate", resignationDate)}
                help={SC_MONTHLY_BOARD.resignationDate.help}
              />
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10"
            disabled={isSaving}
            onClick={async () => {
              if (!values.isDirector && !values.isShareholder && !values.isBoard && !values.isManagement) {
                toast.error(SELECT_AT_LEAST_ONE_ROLE_MESSAGE);
                return;
              }
              const officer = isIssuerOfficerRole(values);
              const issues = validateIssuerPersonForm({
                entityType: values.entityType,
                name: values.name,
                identityPrefix: values.identityPrefix,
                identityNumber: values.identityNumber,
                dateOfBirth: values.dateOfBirth,
                dateOfIncorporation: values.dateOfIncorporation,
                gender: values.gender,
                nationality: values.nationality,
                countryOfIncorporation: values.countryOfIncorporation,
                line1: values.line1,
                state: values.state,
                postalCode: values.postalCode,
                isShareholder: values.isShareholder || values.entityType === "CORPORATE",
                isOfficer: officer && values.entityType !== "CORPORATE",
                shareType: values.shareType,
                shareTypeOther: values.shareTypeOther,
                shareholdingUnits: values.shareholdingUnits,
                shareholdingAmount: values.shareholdingAmount,
                shareholdingPercentage: values.shareholdingPercentage,
                designation: values.designation,
                designationOther: values.designationOther,
                appointmentDate: values.appointmentDate,
              });
              if (
                enforceIssuerShareholderMinimum &&
                (values.isShareholder || values.entityType === "CORPORATE")
              ) {
                const shareIssue = issuerShareholdingThresholdIssue(values.shareholdingPercentage, {
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
              try {
                await onSave(values);
              } catch (err) {
                if (isProfileValidationError(err)) setFieldErrors(err.fieldErrors);
              }
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  help,
  required = false,
  error,
  maxLength,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date";
  help?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "email" | "tel" | "text";
}) {
  return (
    <div className="space-y-1.5">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input
        className="h-10 text-ui"
        type={type}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="text-meta text-destructive">{error}</p> : null}
    </div>
  );
}
