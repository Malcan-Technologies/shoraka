"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  type ScCompanyType,
} from "@cashsouk/types";
import { ProfileFieldGrid, ProfileReadField } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  }, [basic, isEditing, org]);

  const companyTypeLabel =
    org.scCompanyType && org.scCompanyType in SC_COMPANY_TYPE_LABELS
      ? SC_COMPANY_TYPE_LABELS[org.scCompanyType as ScCompanyType]
      : basic?.entityType ?? null;
  const ssm = org.registrationNumber || basic?.ssmRegisterNumber;
  const businessName = org.name || basic?.businessName;

  const save = useMutation({
    mutationFn: async () => {
      const master: Record<string, unknown> = {};
      if (!org.dateOfIncorporation && dateOfIncorporation) master.dateOfIncorporation = dateOfIncorporation;
      if (!org.dateOfCommencement && dateOfCommencement) master.dateOfCommencement = dateOfCommencement;
      if (!org.countryOfIncorporation && countryOfIncorporation.trim()) {
        master.countryOfIncorporation = countryOfIncorporation.trim();
      }
      if (!org.scCompanyType && scCompanyType) master.scCompanyType = scCompanyType;
      if (!org.companyEmail && companyEmail.trim()) master.companyEmail = companyEmail.trim();
      if (!org.phoneNumber && phoneNumber.trim()) master.phoneNumber = phoneNumber.trim();

      if (Object.keys(master).length > 0) {
        const res = await api.patchMasterProfile("issuer", organizationId, master);
        if (!res.success) throw new Error(res.error.message);
      }

      const nextEmployees = employees.trim() === "" ? null : Number(employees);
      if (employees.trim() !== "" && !Number.isInteger(nextEmployees)) {
        throw new Error("Number of employees must be a whole number");
      }
      const corp = await api.patch(`/v1/organizations/issuer/${organizationId}/corporate-info`, {
        industry: industry.trim() || null,
        numberOfEmployees: nextEmployees,
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
          onEdit={() => setIsEditing(true)}
          onCancel={() => setIsEditing(false)}
        />
      }
    >
      <div className="space-y-4">
        <ProfileFieldGrid>
          <ProfileReadField label="Business Name" value={displayProfileValue(businessName)} locked missing={missing.has("name")} />
          <ProfileReadField label="SSM / ROC" value={displayProfileValue(ssm)} locked missing={missing.has("registrationNumber")} />
          {isEditing && !org.scCompanyType ? (
            <SelectRow
              label="Company Type"
              value={scCompanyType}
              onChange={setScCompanyType}
            />
          ) : (
            <ProfileReadField
              label="Company Type"
              value={displayProfileValue(companyTypeLabel)}
              locked={Boolean(org.scCompanyType)}
              missing={missing.has("scCompanyType")}
            />
          )}
          {isEditing && !org.dateOfIncorporation ? (
            <InputRow
              label="Date of Incorporation"
              type="date"
              value={dateOfIncorporation}
              onChange={setDateOfIncorporation}
            />
          ) : (
            <ProfileReadField
              label="Date of Incorporation"
              value={displayProfileValue(formatDate(org.dateOfIncorporation))}
              locked={Boolean(org.dateOfIncorporation)}
              missing={missing.has("dateOfIncorporation")}
            />
          )}
          {isEditing && !org.dateOfCommencement ? (
            <InputRow
              label="Date of Commencement"
              type="date"
              value={dateOfCommencement}
              onChange={setDateOfCommencement}
            />
          ) : (
            <ProfileReadField
              label="Date of Commencement"
              value={displayProfileValue(formatDate(org.dateOfCommencement))}
              locked={Boolean(org.dateOfCommencement)}
              missing={missing.has("dateOfCommencement")}
            />
          )}
          {isEditing && !org.countryOfIncorporation ? (
            <InputRow
              label="Country of Incorporation"
              value={countryOfIncorporation}
              onChange={setCountryOfIncorporation}
            />
          ) : (
            <ProfileReadField
              label="Country of Incorporation"
              value={displayProfileValue(org.countryOfIncorporation)}
              locked={Boolean(org.countryOfIncorporation)}
              missing={missing.has("countryOfIncorporation")}
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
          <ProfileReadField label="Annual Revenue" value={displayProfileValue(basic?.annualRevenue)} locked />
          <ProfileReadField label="Website" value={displayProfileValue(basic?.website)} locked />
          {isEditing && !org.companyEmail ? (
            <InputRow label="Company Email" value={companyEmail} onChange={setCompanyEmail} />
          ) : (
            <ProfileReadField
              label="Company Email"
              value={displayProfileValue(org.companyEmail)}
              locked={Boolean(org.companyEmail)}
              missing={missing.has("companyEmail")}
            />
          )}
          {isEditing && !org.phoneNumber ? (
            <InputRow label="Phone" value={phoneNumber} onChange={setPhoneNumber} />
          ) : (
            <ProfileReadField
              label="Phone"
              value={displayProfileValue(org.phoneNumber)}
              locked={Boolean(org.phoneNumber)}
              missing={missing.has("phoneNumber")}
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
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui font-medium">{label}</Label>
      <Input className="h-11 text-ui" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui font-medium">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange}>
        <SelectTrigger className="h-11 text-ui">
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
    </div>
  );
}
