"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  displayScCompanyTypeLabel,
  firstIssueMessage,
  humanizeApiValidationMessage,
  isProfileValidationError,
  issuesByField,
  PROFILE_HELP,
  PROFILE_LABEL,
  profileValidationErrorFromApi,
  scAppendixASelectValues,
  storedProfilePhone,
  validateIssuerCompanyForm,
} from "@cashsouk/types";
import { ComRepFieldLabel, ProfileFieldGrid, ProfilePhoneInput, ProfileReadField } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { displayProfileValue, ProfileCard, ProfileEditToggle } from "./profile-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export type IssuerCompanyDetailsOrg = {
  name?: string | null;
  registrationNumber?: string | null;
  phoneNumber?: string | null;
  dateOfIncorporation?: string | Date | null;
  dateOfCommencement?: string | Date | null;
  countryOfIncorporation?: string | null;
  scCompanyType?: string | null;
  corporateOnboardingData?: {
    basicInfo?: {
      tinNumber?: string;
      industry?: string;
      entityType?: string;
      businessName?: string;
      numberOfEmployees?: number;
      ssmRegisterNumber?: string;
      annualRevenue?: string;
      website?: string;
    };
  } | null;
};

export function IssuerCompanyDetailsCard({
  organizationId,
  org,
  canEdit,
}: {
  organizationId: string;
  org: IssuerCompanyDetailsOrg;
  canEdit: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const { corporateInfo } = useCorporateInfo(organizationId);
  const completenessQuery = useQuery({
    queryKey: ["issuer", "profile-completeness", organizationId],
    queryFn: async () => {
      const res = await api.getProfileCompleteness("issuer", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
  const missing = new Set(
    (completenessQuery.data?.missing ?? [])
      .filter((item) => item.step === "company" && !item.partyKey)
      .map((item) => item.field)
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const basic = corporateInfo?.basicInfo ?? org.corporateOnboardingData?.basicInfo;
  const [industry, setIndustry] = React.useState(basic?.industry ?? "");
  const [employees, setEmployees] = React.useState(
    basic?.numberOfEmployees !== undefined ? String(basic.numberOfEmployees) : ""
  );
  const [dateOfIncorporation, setDateOfIncorporation] = React.useState(toDateInput(org.dateOfIncorporation));
  const [dateOfCommencement, setDateOfCommencement] = React.useState(toDateInput(org.dateOfCommencement));
  const [countryOfIncorporation, setCountryOfIncorporation] = React.useState(
    org.countryOfIncorporation ?? ""
  );
  const [scCompanyType, setScCompanyType] = React.useState(org.scCompanyType ?? "");
  const [phoneNumber, setPhoneNumber] = React.useState(org.phoneNumber ?? "");
  const [website, setWebsite] = React.useState(basic?.website ?? "");
  const [annualRevenue, setAnnualRevenue] = React.useState(basic?.annualRevenue ?? "");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isEditing) return;
    setIndustry(basic?.industry ?? "");
    setEmployees(basic?.numberOfEmployees !== undefined ? String(basic.numberOfEmployees) : "");
    setDateOfIncorporation(toDateInput(org.dateOfIncorporation));
    setDateOfCommencement(toDateInput(org.dateOfCommencement));
    setCountryOfIncorporation(org.countryOfIncorporation ?? "");
    setScCompanyType(org.scCompanyType ?? "");
    setPhoneNumber(org.phoneNumber ?? "");
    setWebsite(basic?.website ?? "");
    setAnnualRevenue(basic?.annualRevenue ?? "");
  }, [basic, isEditing, org]);

  const companyTypeLabel = displayScCompanyTypeLabel(org.scCompanyType, basic?.entityType);
  const ssm = org.registrationNumber || basic?.ssmRegisterNumber;
  const businessName = org.name || basic?.businessName;

  const save = useMutation({
    mutationFn: async () => {
      const issues = validateIssuerCompanyForm({
        name: businessName,
        includeName: false,
        scCompanyType: org.scCompanyType ?? scCompanyType,
        dateOfIncorporation: org.dateOfIncorporation ?? dateOfIncorporation,
        dateOfCommencement: org.dateOfCommencement ?? dateOfCommencement,
        countryOfIncorporation: org.countryOfIncorporation ?? countryOfIncorporation,
        phoneNumber,
      });
      if (issues.length > 0) {
        setFieldErrors(issuesByField(issues));
        const first = issues[0];
        const el = document.getElementById(`field-${first.field}`);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        if (el instanceof HTMLElement) el.focus();
        throw new Error(firstIssueMessage(issues) ?? "Complete the required fields.");
      }
      setFieldErrors({});

      const master: Record<string, unknown> = {};
      if (phoneNumber.trim()) {
        master.phoneNumber = storedProfilePhone(phoneNumber.trim()) ?? phoneNumber.trim();
      } else {
        master.phoneNumber = null;
      }
      if (!org.dateOfIncorporation) master.dateOfIncorporation = dateOfIncorporation.trim();
      if (!org.dateOfCommencement) master.dateOfCommencement = dateOfCommencement.trim();
      if (!org.countryOfIncorporation) master.countryOfIncorporation = countryOfIncorporation.trim();
      if (!org.scCompanyType) master.scCompanyType = scCompanyType;

      const res = await api.patchMasterProfile("issuer", organizationId, master);
      if (!res.success) throw profileValidationErrorFromApi(res.error);

      const nextEmployees = employees.trim() === "" ? null : Number(employees);
      if (employees.trim() !== "" && !Number.isInteger(nextEmployees)) {
        setFieldErrors((current) => ({ ...current, numberOfEmployees: "Enter a whole number." }));
        throw new Error("Enter a whole number.");
      }
      const corp = await api.patch(`/v1/organizations/issuer/${organizationId}/corporate-info`, {
        industry: industry.trim() || null,
        numberOfEmployees: nextEmployees,
        website: website.trim() || null,
        annualRevenue: annualRevenue.trim() || null,
      });
      if (!corp.success) throw profileValidationErrorFromApi(corp.error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", organizationId] });
      toast.success("Company details updated");
      setIsEditing(false);
    },
    onError: (err: Error) => {
      if (isProfileValidationError(err) && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors);
      }
      toast.error(humanizeApiValidationMessage(err.message));
    },
  });

  return (
    <ProfileCard
      id="profile-company"
      title="Company Details"
      description="Registration and company information"
      action={
        <ProfileEditToggle
          canEdit={canEdit}
          isEditing={isEditing}
          onEdit={() => {
            setFieldErrors({});
            setIsEditing(true);
          }}
          onCancel={() => {
            setFieldErrors({});
            setIsEditing(false);
          }}
        />
      }
    >
      <div className="space-y-4">
        <ProfileFieldGrid>
          <ProfileReadField
            label={PROFILE_LABEL.companyName}
            value={displayProfileValue(businessName)}
            locked
            missing={missing.has("name")}
          />
          <ProfileReadField
            label={PROFILE_LABEL.companyRegistrationNumber}
            value={displayProfileValue(ssm)}
            locked
            missing={missing.has("registrationNumber")}
          />
          {isEditing && !org.scCompanyType ? (
            <SelectRow
              label={PROFILE_LABEL.typeOfCompany}
              value={scCompanyType}
              onChange={(value) => {
                setScCompanyType(value);
                setFieldErrors((current) => ({ ...current, scCompanyType: "" }));
              }}
              required
              error={fieldErrors.scCompanyType}
            />
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.typeOfCompany}
              value={displayProfileValue(companyTypeLabel)}
              locked={Boolean(org.scCompanyType)}
              missing={missing.has("scCompanyType")}
            />
          )}
          {isEditing && !org.dateOfIncorporation ? (
            <InputRow
              id="field-dateOfIncorporation"
              label={PROFILE_LABEL.dateOfIncorporation}
              type="date"
              value={dateOfIncorporation}
              onChange={(value) => {
                setDateOfIncorporation(value);
                setFieldErrors((current) => ({ ...current, dateOfIncorporation: "" }));
              }}
              required
              error={fieldErrors.dateOfIncorporation}
            />
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.dateOfIncorporation}
              value={displayProfileValue(formatDate(org.dateOfIncorporation))}
              locked={Boolean(org.dateOfIncorporation)}
              missing={missing.has("dateOfIncorporation")}
            />
          )}
          {isEditing && !org.dateOfCommencement ? (
            <InputRow
              id="field-dateOfCommencement"
              label={PROFILE_LABEL.dateBusinessCommenced}
              type="date"
              value={dateOfCommencement}
              onChange={(value) => {
                setDateOfCommencement(value);
                setFieldErrors((current) => ({ ...current, dateOfCommencement: "" }));
              }}
              required
              error={fieldErrors.dateOfCommencement}
            />
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.dateBusinessCommenced}
              value={displayProfileValue(formatDate(org.dateOfCommencement))}
              locked={Boolean(org.dateOfCommencement)}
              missing={missing.has("dateOfCommencement")}
            />
          )}
          {isEditing && !org.countryOfIncorporation ? (
            <CountrySelectRow
              label={PROFILE_LABEL.countryOfIncorporation}
              value={countryOfIncorporation}
              onChange={(value) => {
                setCountryOfIncorporation(value);
                setFieldErrors((current) => ({ ...current, countryOfIncorporation: "" }));
              }}
              required
              error={fieldErrors.countryOfIncorporation}
            />
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.countryOfIncorporation}
              value={displayProfileValue(org.countryOfIncorporation)}
              locked={Boolean(org.countryOfIncorporation)}
              missing={missing.has("countryOfIncorporation")}
            />
          )}
          <ProfileReadField label={PROFILE_LABEL.tin} value={displayProfileValue(basic?.tinNumber)} locked />
          {isEditing ? (
            <InputRow label={PROFILE_LABEL.industry} value={industry} onChange={setIndustry} />
          ) : (
            <ProfileReadField label={PROFILE_LABEL.industry} value={displayProfileValue(basic?.industry)} />
          )}
          {isEditing ? (
            <InputRow
              label={PROFILE_LABEL.numberOfEmployees}
              value={employees}
              onChange={(value) => setEmployees(value.replace(/\D/g, ""))}
              inputMode="numeric"
              error={fieldErrors.numberOfEmployees}
            />
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.numberOfEmployees}
              value={displayProfileValue(
                basic?.numberOfEmployees !== undefined ? String(basic.numberOfEmployees) : null
              )}
            />
          )}
          {isEditing ? (
            <InputRow label={`${PROFILE_LABEL.annualRevenue} (RM)`} value={annualRevenue} onChange={setAnnualRevenue} />
          ) : (
            <ProfileReadField label={PROFILE_LABEL.annualRevenue} value={displayProfileValue(basic?.annualRevenue)} />
          )}
          {isEditing ? (
            <InputRow
              label={PROFILE_LABEL.website}
              value={website}
              onChange={setWebsite}
            />
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.website}
              value={displayProfileValue(basic?.website)}
            />
          )}
          {isEditing ? (
            <div className="space-y-2">
              <ComRepFieldLabel
                label={PROFILE_LABEL.companyPhone}
                optional
                help={PROFILE_HELP.companyPhone}
              />
              <ProfilePhoneInput
                id="field-phoneNumber"
                value={phoneNumber}
                onChange={(value) => {
                  setPhoneNumber(value);
                  setFieldErrors((current) => ({ ...current, phoneNumber: "" }));
                }}
                error={Boolean(fieldErrors.phoneNumber)}
              />
              {fieldErrors.phoneNumber ? (
                <p className="text-meta text-destructive">{fieldErrors.phoneNumber}</p>
              ) : null}
            </div>
          ) : (
            <ProfileReadField
              label={PROFILE_LABEL.companyPhone}
              value={displayProfileValue(org.phoneNumber)}
            />
          )}
        </ProfileFieldGrid>
        {isEditing ? (
          <div className="flex justify-end">
            <Button
              className="h-10 rounded-xl"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : null}
      </div>
    </ProfileCard>
  );
}

function InputRow({
  id,
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
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  help?: string;
  required?: boolean;
  error?: string;
  maxLength?: number;
  inputMode?: "numeric" | "decimal" | "email" | "tel" | "text";
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} optional={!required} help={help} />
      <Input
        id={id}
        className="h-11 text-ui"
        type={type}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-required={required}
      />
      {error ? <p className="text-meta text-destructive">{error}</p> : null}
    </div>
  );
}

function CountrySelectRow({
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
      <ComRepFieldLabel label={label} required={required} optional={!required} help={help} />
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id="field-countryOfIncorporation" className="h-11 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {scAppendixASelectValues(value).map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-meta text-destructive">{error}</p> : null}
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
  required = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} optional={!required} />
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger id="field-scCompanyType" className="h-11 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {SC_COMPANY_TYPES.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {SC_COMPANY_TYPE_LABELS[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-meta text-destructive">{error}</p> : null}
    </div>
  );
}
