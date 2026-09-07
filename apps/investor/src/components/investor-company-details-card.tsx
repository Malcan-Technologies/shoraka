"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { firstIssueMessage, humanizeApiValidationMessage, isProfileValidationError, issuesByField, profileValidationErrorFromApi, SC_MONTHLY_INVESTOR, scAppendixASelectValues, validateInvestorCorporateForm } from "@cashsouk/types";
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
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function InvestorCompanyDetailsCard({
  organizationId,
  name,
  registrationNumber,
  dateOfIncorporation,
  countryOfIncorporation,
  canEdit,
}: {
  organizationId: string;
  name?: string | null;
  registrationNumber?: string | null;
  dateOfIncorporation?: string | Date | null;
  countryOfIncorporation?: string | null;
  canEdit: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const completenessQuery = useQuery({
    queryKey: ["investor", "profile-completeness", organizationId],
    queryFn: async () => {
      const res = await api.getProfileCompleteness("investor", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
  const missing = new Set((completenessQuery.data?.userMissing ?? completenessQuery.data?.missing ?? []).map((item) => item.field));
  const [isEditing, setIsEditing] = React.useState(false);
  const [dateValue, setDateValue] = React.useState(toDateInput(dateOfIncorporation));
  const [country, setCountry] = React.useState(countryOfIncorporation ?? "");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isEditing) return;
    setDateValue(toDateInput(dateOfIncorporation));
    setCountry(countryOfIncorporation ?? "");
  }, [countryOfIncorporation, dateOfIncorporation, isEditing]);

  const save = useMutation({
    mutationFn: async () => {
      const issues = validateInvestorCorporateForm({
        dateOfIncorporation: dateOfIncorporation ?? dateValue,
        countryOfIncorporation: countryOfIncorporation ?? country,
      });
      if (issues.length > 0) {
        setFieldErrors(issuesByField(issues));
        throw new Error(firstIssueMessage(issues) ?? "Please check the highlighted fields.");
      }
      setFieldErrors({});
      const master: Record<string, unknown> = {};
      if (!dateOfIncorporation) master.dateOfIncorporation = dateValue.trim();
      if (!countryOfIncorporation) master.countryOfIncorporation = country.trim();
      if (Object.keys(master).length === 0) return;
      const res = await api.patchMasterProfile("investor", organizationId, master);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["investor", "profile-completeness", organizationId] });
      toast.success("Company details updated");
      setIsEditing(false);
    },
    onError: (err: Error) => {
      if (isProfileValidationError(err)) setFieldErrors(err.fieldErrors);
      toast.error(humanizeApiValidationMessage(err.message));
    },
  });

  return (
    <div id="profile-company" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-6">
        <div>
          <h2 className="text-lg font-semibold">Company Details</h2>
          <p className="text-sm text-muted-foreground">Registration and company information</p>
        </div>
        {canEdit && !isEditing ? (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setIsEditing(true)}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
        {canEdit && isEditing ? (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setIsEditing(false)}>
            <XMarkIcon className="h-4 w-4" />
            Cancel
          </Button>
        ) : null}
      </div>
      <div className="space-y-4 p-6">
        <ProfileFieldGrid>
          <ProfileReadField
            label={SC_MONTHLY_INVESTOR.investorName.label}
            value={name || "—"}
            locked
            missing={missing.has("name")}
            required
            help={SC_MONTHLY_INVESTOR.investorName.help}
          />
          <ProfileReadField
            label={SC_MONTHLY_INVESTOR.investorIdentification.label}
            value={registrationNumber || "—"}
            locked
            missing={missing.has("registrationNumber")}
            required
            help={SC_MONTHLY_INVESTOR.investorIdentification.help}
          />
          {isEditing && !dateOfIncorporation ? (
            <div className="space-y-2">
              <ComRepFieldLabel
                label={SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.label}
                required
                help={SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.help}
              />
              <Input
                className="h-11 text-ui"
                type="date"
                value={dateValue}
                onChange={(event) => {
                  setDateValue(event.target.value);
                  setFieldErrors((current) => ({ ...current, dateOfIncorporation: "" }));
                }}
              />
              {fieldErrors.dateOfIncorporation ? (
                <p className="text-meta text-destructive">{fieldErrors.dateOfIncorporation}</p>
              ) : null}
            </div>
          ) : (
            <ProfileReadField
              label={SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.label}
              value={formatDate(dateOfIncorporation)}
              locked={Boolean(dateOfIncorporation)}
              missing={missing.has("dateOfIncorporation")}
              required
              help={SC_MONTHLY_INVESTOR.dateOfBirthIncorporation.help}
            />
          )}
          {isEditing && !countryOfIncorporation ? (
            <div className="space-y-2">
              <ComRepFieldLabel
                label={SC_MONTHLY_INVESTOR.nationalityCountry.label}
                required
                help={SC_MONTHLY_INVESTOR.nationalityCountry.help}
              />
              <Select
                value={country || undefined}
                onValueChange={(value) => {
                  setCountry(value);
                  setFieldErrors((current) => ({ ...current, countryOfIncorporation: "" }));
                }}
              >
                <SelectTrigger className="h-11 text-ui">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {scAppendixASelectValues(country).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.countryOfIncorporation ? (
                <p className="text-meta text-destructive">{fieldErrors.countryOfIncorporation}</p>
              ) : null}
            </div>
          ) : (
            <ProfileReadField
              label={SC_MONTHLY_INVESTOR.nationalityCountry.label}
              value={countryOfIncorporation || "—"}
              locked={Boolean(countryOfIncorporation)}
              missing={missing.has("countryOfIncorporation")}
              required
              help={SC_MONTHLY_INVESTOR.nationalityCountry.help}
            />
          )}
        </ProfileFieldGrid>
        {isEditing ? (
          <div className="flex justify-end">
            <Button className="h-10 rounded-xl" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
