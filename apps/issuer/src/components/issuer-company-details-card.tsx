"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  type ScCompanyType,
} from "@cashsouk/types";
import { KeyValueGrid } from "@cashsouk/ui";
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
      {isEditing ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Business Name" value={businessName} />
            <ReadRow label="SSM / ROC" value={ssm} />
            {org.scCompanyType ? (
              <ReadRow label="Company Type" value={companyTypeLabel} />
            ) : (
              <SelectRow
                label="Company Type"
                value={scCompanyType}
                onChange={setScCompanyType}
                options={SC_COMPANY_TYPES.map((value) => ({
                  value,
                  label: SC_COMPANY_TYPE_LABELS[value],
                }))}
              />
            )}
            {org.dateOfIncorporation ? (
              <ReadRow label="Date of Incorporation" value={formatDate(org.dateOfIncorporation)} />
            ) : (
              <InputRow
                label="Date of Incorporation"
                type="date"
                value={dateOfIncorporation}
                onChange={setDateOfIncorporation}
              />
            )}
            {org.dateOfCommencement ? (
              <ReadRow label="Date of Commencement" value={formatDate(org.dateOfCommencement)} />
            ) : (
              <InputRow
                label="Date of Commencement"
                type="date"
                value={dateOfCommencement}
                onChange={setDateOfCommencement}
              />
            )}
            {org.countryOfIncorporation ? (
              <ReadRow label="Country of Incorporation" value={org.countryOfIncorporation} />
            ) : (
              <InputRow
                label="Country of Incorporation"
                value={countryOfIncorporation}
                onChange={setCountryOfIncorporation}
              />
            )}
            <ReadRow label="TIN" value={basic?.tinNumber} />
            <InputRow label="Industry" value={industry} onChange={setIndustry} />
            <InputRow label="Number of Employees" value={employees} onChange={setEmployees} />
            <ReadRow label="Annual Revenue" value={basic?.annualRevenue} />
            <ReadRow label="Website" value={basic?.website} />
            {org.companyEmail ? (
              <ReadRow label="Company Email" value={org.companyEmail} />
            ) : (
              <InputRow label="Company Email" value={companyEmail} onChange={setCompanyEmail} />
            )}
            {org.phoneNumber ? (
              <ReadRow label="Phone" value={org.phoneNumber} />
            ) : (
              <InputRow label="Phone" value={phoneNumber} onChange={setPhoneNumber} />
            )}
          </div>
          <div className="flex justify-end">
            <Button
              className="h-10 rounded-xl"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <KeyValueGrid
          items={[
            { label: "Business Name", value: displayProfileValue(businessName) },
            { label: "SSM / ROC", value: displayProfileValue(ssm) },
            { label: "Company Type", value: displayProfileValue(companyTypeLabel) },
            { label: "Date of Incorporation", value: displayProfileValue(formatDate(org.dateOfIncorporation)) },
            { label: "Date of Commencement", value: displayProfileValue(formatDate(org.dateOfCommencement)) },
            { label: "Country of Incorporation", value: displayProfileValue(org.countryOfIncorporation) },
            { label: "TIN", value: displayProfileValue(basic?.tinNumber) },
            { label: "Industry", value: displayProfileValue(basic?.industry) },
            {
              label: "Number of Employees",
              value: displayProfileValue(
                basic?.numberOfEmployees !== undefined ? String(basic.numberOfEmployees) : null
              ),
            },
            { label: "Annual Revenue", value: displayProfileValue(basic?.annualRevenue) },
            { label: "Website", value: displayProfileValue(basic?.website) },
            { label: "Company Email", value: displayProfileValue(org.companyEmail) },
            { label: "Phone", value: displayProfileValue(org.phoneNumber) },
          ]}
        />
      )}
    </ProfileCard>
  );
}

function ReadRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-meta text-muted-foreground">{label}</p>
      <p className="text-ui">{displayProfileValue(value)}</p>
    </div>
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
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectRow({
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
