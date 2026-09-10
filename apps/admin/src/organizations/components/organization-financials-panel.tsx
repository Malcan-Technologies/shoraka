"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { type OrganizationDetailResponse } from "@cashsouk/types";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import {
  ProfileFinancialSaveBar,
  ProfileFinancialStatementsBody,
  profileFinancialDraftFromValues,
  validateProfileFinancialDraft,
} from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { missingFieldKeys } from "@/organizations/utils/organization-profile-overview";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function OrganizationFinancialsPanel({
  org,
  organizationId,
}: {
  org: OrganizationDetailResponse;
  organizationId: string;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const financials = org.issuerFinancials ?? null;
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const missing = missingFieldKeys(org.profileCompleteness, "financials");
  const latestYear = financials?.latestYear;
  const complete = missing.size === 0;
  const values = financials?.fields ?? null;

  React.useEffect(() => {
    if (isEditing) return;
    setDraft(profileFinancialDraftFromValues(values));
    setFieldErrors({});
  }, [isEditing, values]);

  const save = useMutation({
    mutationFn: async () => {
      const year = latestYear || String(new Date().getFullYear() - 1);
      const result = validateProfileFinancialDraft(draft);
      if (result.issues.length > 0) {
        setFieldErrors(result.fieldErrors);
        const first = result.issues[0];
        const el = document.getElementById(`profile-financial-${first.field}`);
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        if (el instanceof HTMLElement) el.focus();
        throw new Error(result.firstMessage);
      }
      setFieldErrors({});
      const res = await api.patchAdminIssuerFinancials(organizationId, year, result.fields);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "organization-detail", "issuer", organizationId],
      });
      toast.success("Financials updated");
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card id="profile-financials" className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BanknotesIcon}
        title="Financial Statements"
        description={
          latestYear ? `FY${latestYear} on this company profile.` : "Latest financial statements for this company"
        }
        actions={
          canManage && !isEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(profileFinancialDraftFromValues(values));
                setFieldErrors({});
                setIsEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        <ProfileFinancialStatementsBody
          yearLabel={latestYear ? `FY${latestYear}` : null}
          values={values}
          isEditing={isEditing}
          draft={draft}
          fieldErrors={fieldErrors}
          missingCount={missing.size}
          complete={complete}
          onDraftChange={(key, value) => {
            setDraft((current) => ({ ...current, [key]: value }));
            setFieldErrors((current) => ({ ...current, [key]: "" }));
          }}
        />
        {isEditing ? (
          <ProfileFinancialSaveBar
            isSaving={save.isPending}
            onCancel={() => {
              setDraft(profileFinancialDraftFromValues(values));
              setFieldErrors({});
              setIsEditing(false);
            }}
            onSave={() => save.mutate()}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
