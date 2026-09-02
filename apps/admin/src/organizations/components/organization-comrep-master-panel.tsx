"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import {
  SC_COMPANY_CATEGORIES,
  SC_COMPANY_CATEGORY_LABELS,
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  SC_INVESTOR_CATEGORIES,
  SC_INVESTOR_CATEGORY_LABELS,
  SC_MALAYSIAN_STATES,
  type OrganizationDetailResponse,
  type PortalType,
} from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function OrganizationComrepMasterPanel({
  org,
  portal,
  organizationId,
}: {
  org: OrganizationDetailResponse;
  portal: PortalType;
  organizationId: string;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState(() => ({
    dateOfIncorporation: toDate(org.dateOfIncorporation),
    dateOfCommencement: toDate(org.dateOfCommencement),
    countryOfIncorporation: org.countryOfIncorporation ?? "",
    scCompanyType: org.scCompanyType ?? "",
    companyCategory: org.companyCategory ?? "",
    companyEmail: org.companyEmail ?? "",
    scInvestorCategory: org.scInvestorCategory ?? "",
    state: org.residentialAddress?.state ?? "",
    postalCode: org.residentialAddress?.postalCode ?? "",
  }));

  React.useEffect(() => {
    setDraft({
      dateOfIncorporation: toDate(org.dateOfIncorporation),
      dateOfCommencement: toDate(org.dateOfCommencement),
      countryOfIncorporation: org.countryOfIncorporation ?? "",
      scCompanyType: org.scCompanyType ?? "",
      companyCategory: org.companyCategory ?? "",
      companyEmail: org.companyEmail ?? "",
      scInvestorCategory: org.scInvestorCategory ?? "",
      state: org.residentialAddress?.state ?? "",
      postalCode: org.residentialAddress?.postalCode ?? "",
    });
  }, [org]);

  const save = useMutation({
    mutationFn: async () => {
      const payload =
        portal === "issuer"
          ? {
              dateOfIncorporation: draft.dateOfIncorporation || null,
              dateOfCommencement: draft.dateOfCommencement || null,
              countryOfIncorporation: draft.countryOfIncorporation || null,
              scCompanyType: draft.scCompanyType || null,
              companyCategory: draft.companyCategory || null,
              companyEmail: draft.companyEmail || null,
            }
          : {
              scInvestorCategory: draft.scInvestorCategory || null,
              dateOfIncorporation: draft.dateOfIncorporation || null,
              countryOfIncorporation: draft.countryOfIncorporation || null,
              residentialAddress: {
                state: draft.state || null,
                postalCode: draft.postalCode || null,
              },
            };
      const res = await api.patchAdminMasterProfile(portal, organizationId, payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "organization-detail", portal, organizationId],
      });
      toast.success("CashSouk master profile updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeness = org.profileCompleteness;

  return (
    <Card className="mt-6">
      <AdminDetailCardHeader
        icon={ClipboardDocumentListIcon}
        title="ComRep master profile"
        description="CashSouk is the master. Adopting an external value here updates what the issuer or investor sees."
      />
      <CardContent className="space-y-4">
        {completeness ? (
          <div className="space-y-2">
            <p className="text-ui text-muted-foreground">
              Completeness {completeness.percent}%
              {completeness.complete ? " — complete" : ` — ${completeness.missing.length} missing`}
            </p>
            {!completeness.complete && completeness.missing.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-ui text-muted-foreground">
                {completeness.missing.slice(0, 20).map((item) => (
                  <li key={`${item.step}-${item.field}-${item.partyKey ?? ""}`}>
                    {item.label}
                    {item.partyName ? ` (${item.partyName})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {portal === "issuer" ? (
            <>
              <DateField
                label="Date of incorporation"
                value={draft.dateOfIncorporation}
                onChange={(v) => setDraft({ ...draft, dateOfIncorporation: v })}
                disabled={!canManage}
              />
              <DateField
                label="Date of commencement"
                value={draft.dateOfCommencement}
                onChange={(v) => setDraft({ ...draft, dateOfCommencement: v })}
                disabled={!canManage}
              />
              <TextField
                label="Country of incorporation"
                value={draft.countryOfIncorporation}
                onChange={(v) => setDraft({ ...draft, countryOfIncorporation: v })}
                disabled={!canManage}
              />
              <SelectField
                label="Type of company"
                value={draft.scCompanyType}
                onChange={(v) => setDraft({ ...draft, scCompanyType: v })}
                options={SC_COMPANY_TYPES.map((k) => ({ value: k, label: SC_COMPANY_TYPE_LABELS[k] }))}
                disabled={!canManage}
              />
              <SelectField
                label="Company category"
                value={draft.companyCategory}
                onChange={(v) => setDraft({ ...draft, companyCategory: v })}
                options={SC_COMPANY_CATEGORIES.map((k) => ({
                  value: k,
                  label: SC_COMPANY_CATEGORY_LABELS[k],
                }))}
                disabled={!canManage}
              />
              <TextField
                label="Company email"
                value={draft.companyEmail}
                onChange={(v) => setDraft({ ...draft, companyEmail: v })}
                disabled={!canManage}
              />
            </>
          ) : (
            <>
              <SelectField
                label="Type of investor"
                value={draft.scInvestorCategory}
                onChange={(v) => setDraft({ ...draft, scInvestorCategory: v })}
                options={SC_INVESTOR_CATEGORIES.map((k) => ({
                  value: k,
                  label: SC_INVESTOR_CATEGORY_LABELS[k],
                }))}
                disabled={!canManage}
              />
              {org.type === "COMPANY" ? (
                <>
                  <DateField
                    label="Date of incorporation"
                    value={draft.dateOfIncorporation}
                    onChange={(v) => setDraft({ ...draft, dateOfIncorporation: v })}
                    disabled={!canManage}
                  />
                  <TextField
                    label="Country of incorporation"
                    value={draft.countryOfIncorporation}
                    onChange={(v) => setDraft({ ...draft, countryOfIncorporation: v })}
                    disabled={!canManage}
                  />
                </>
              ) : (
                <>
                  <SelectField
                    label="State"
                    value={draft.state}
                    onChange={(v) => setDraft({ ...draft, state: v })}
                    options={SC_MALAYSIAN_STATES.map((s) => ({ value: s, label: s }))}
                    disabled={!canManage}
                  />
                  <TextField
                    label="Postcode"
                    value={draft.postalCode}
                    onChange={(v) => setDraft({ ...draft, postalCode: v })}
                    disabled={!canManage}
                  />
                </>
              )}
            </>
          )}
        </div>
        {canManage ? (
          <Button className="h-10" onClick={() => save.mutate()} disabled={save.isPending}>
            Save master fields
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function toDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(e) => setValue(e, onChange)} disabled={disabled} />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" type="date" value={value} onChange={(e) => setValue(e, onChange)} disabled={disabled} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
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

function setValue(e: React.ChangeEvent<HTMLInputElement>, onChange: (v: string) => void) {
  onChange(e.target.value);
}
