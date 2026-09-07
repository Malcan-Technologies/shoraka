"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  SC_MONTHLY_ISSUER,
  displayScCompanyTypeLabel,
  firstIssueMessage,
  issuesByField,
  scAppendixASelectValues,
  validateIssuerCompanyForm,
} from "@cashsouk/types";
import { ComRepFieldLabel, ProfileFieldGrid, ProfileReadField } from "@cashsouk/ui";
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
  companyEmail?: string | null;
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
  const [companyEmail, setCompanyEmail] = React.useState(org.companyEmail ?? "");
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
    setCompanyEmail(org.companyEmail ?? "");
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
        companyEmail,
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

      const master: Record<string, unknown> = {
        companyEmail: companyEmail.trim(),
        phoneNumber: phoneNumber.trim(),
      };
      if (!org.dateOfIncorporation) master.dateOfIncorporation = dateOfIncorporation.trim();
      if (!org.dateOfCommencement) master.dateOfCommencement = dateOfCommencement.trim();
      if (!org.countryOfIncorporation) master.countryOfIncorporation = countryOfIncorporation.trim();
      if (!org.scCompanyType) master.scCompanyType = scCompanyType;

      const res = await api.patchMasterProfile("issuer", organizationId, master);
      if (!res.success) throw new Error(res.error.message);

      const nextEmployees = employees.trim() === "" ? null : Number(employees);
      if (employees.trim() !== "" && !Number.isInteger(nextEmployees)) {
        throw new Error("Number of employees must be a whole number");
      }
      const corp = await api.patch(`/v1/organizations/issuer/${organizationId}/corporate-info`, {
        industry: industry.trim() || null,
        numberOfEmployees: nextEmployees,
        website: website.trim() || null,
        annualRevenue: annualRevenue.trim() || null,
      });
      if (!corp.success) throw new Error(corp.error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", organizationId] });
      toast.success("Company details updated");
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
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
            label={SC_MONTHLY_ISSUER.nameOfIssuer.label}
            value={displayProfileValue(businessName)}
            locked
            missing={missing.has("name")}
            required
          />
          <ProfileReadField
            label={SC_MONTHLY_ISSUER.issuerRoc.label}
            value={displayProfileValue(ssm)}
            locked
            missing={missing.has("registrationNumber")}
            required
            help={SC_MONTHLY_ISSUER.issuerRoc.help}
          />
          {isEditing && !org.scCompanyType ? (
            <SelectRow
              label={SC_MONTHLY_ISSUER.typeOfCompany.label}
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
              label={SC_MONTHLY_ISSUER.typeOfCompany.label}
              value={displayProfileValue(companyTypeLabel)}
              locked={Boolean(org.scCompanyType)}
              missing={missing.has("scCompanyType")}
              required
            />
          )}
          {isEditing && !org.dateOfIncorporation ? (
            <InputRow
              id="field-dateOfIncorporation"
              label={SC_MONTHLY_ISSUER.dateOfIncorporation.label}
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
              label={SC_MONTHLY_ISSUER.dateOfIncorporation.label}
              value={displayProfileValue(formatDate(org.dateOfIncorporation))}
              locked={Boolean(org.dateOfIncorporation)}
              missing={missing.has("dateOfIncorporation")}
              required
            />
          )}
          {isEditing && !org.dateOfCommencement ? (
            <InputRow
              id="field-dateOfCommencement"
              label={SC_MONTHLY_ISSUER.dateOfCommencement.label}
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
              label={SC_MONTHLY_ISSUER.dateOfCommencement.label}
              value={displayProfileValue(formatDate(org.dateOfCommencement))}
              locked={Boolean(org.dateOfCommencement)}
              missing={missing.has("dateOfCommencement")}
              required
            />
          )}
          {isEditing && !org.countryOfIncorporation ? (
            <CountrySelectRow
              label={SC_MONTHLY_ISSUER.countryOfIncorporation.label}
              value={countryOfIncorporation}
              onChange={(value) => {
                setCountryOfIncorporation(value);
                setFieldErrors((current) => ({ ...current, countryOfIncorporation: "" }));
              }}
              help={SC_MONTHLY_ISSUER.countryOfIncorporation.help}
              required
              error={fieldErrors.countryOfIncorporation}
            />
          ) : (
            <ProfileReadField
              label={SC_MONTHLY_ISSUER.countryOfIncorporation.label}
              value={displayProfileValue(org.countryOfIncorporation)}
              locked={Boolean(org.countryOfIncorporation)}
              missing={missing.has("countryOfIncorporation")}
              required
              help={SC_MONTHLY_ISSUER.countryOfIncorporation.help}
            />
          )}
          <ProfileReadField label="TIN" value={displayProfileValue(basic?.tinNumber)} locked />
          {isEditing ? (
            <InputRow label="Industry" value={industry} onChange={setIndustry} />
          ) : (
            <ProfileReadField label="Industry" value={displayProfileValue(basic?.industry)} />
          )}
          {isEditing ? (
            <InputRow label="Number of Employees" value={employees} onChange={setEmployees} />
          ) : (
            <ProfileReadField
              label="Number of Employees"
              value={displayProfileValue(
                basic?.numberOfEmployees !== undefined ? String(basic.numberOfEmployees) : null
              )}
            />
          )}
          {isEditing ? (
            <InputRow label="Annual Revenue" value={annualRevenue} onChange={setAnnualRevenue} />
          ) : (
            <ProfileReadField label="Annual Revenue" value={displayProfileValue(basic?.annualRevenue)} />
          )}
          {isEditing ? (
            <InputRow
              label={SC_MONTHLY_ISSUER.website.label}
              value={website}
              onChange={setWebsite}
              help={SC_MONTHLY_ISSUER.website.help}
            />
          ) : (
            <ProfileReadField
              label={SC_MONTHLY_ISSUER.website.label}
              value={displayProfileValue(basic?.website)}
              help={SC_MONTHLY_ISSUER.website.help}
            />
          )}
          {isEditing ? (
            <InputRow
              id="field-companyEmail"
              label={SC_MONTHLY_ISSUER.emailAddress.label}
              value={companyEmail}
              onChange={(value) => {
                setCompanyEmail(value);
                setFieldErrors((current) => ({ ...current, companyEmail: "" }));
              }}
              help={SC_MONTHLY_ISSUER.emailAddress.help}
              required
              error={fieldErrors.companyEmail}
            />
          ) : (
            <ProfileReadField
              label={SC_MONTHLY_ISSUER.emailAddress.label}
              value={displayProfileValue(org.companyEmail)}
              missing={missing.has("companyEmail")}
              required
              help={SC_MONTHLY_ISSUER.emailAddress.help}
            />
          )}
          {isEditing ? (
            <InputRow
              id="field-phoneNumber"
              label={SC_MONTHLY_ISSUER.phoneNumber.label}
              value={phoneNumber}
              onChange={(value) => {
                setPhoneNumber(value);
                setFieldErrors((current) => ({ ...current, phoneNumber: "" }));
              }}
              help={SC_MONTHLY_ISSUER.phoneNumber.help}
              required
              error={fieldErrors.phoneNumber}
            />
          ) : (
            <ProfileReadField
              label={SC_MONTHLY_ISSUER.phoneNumber.label}
              value={displayProfileValue(org.phoneNumber)}
              missing={missing.has("phoneNumber")}
              required
              help={SC_MONTHLY_ISSUER.phoneNumber.help}
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
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  help?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input
        id={id}
        className="h-11 text-ui"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
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
      <ComRepFieldLabel label={label} required={required} help={help} />
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
      <ComRepFieldLabel label={label} required={required} />
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
