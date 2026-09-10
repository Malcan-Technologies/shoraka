"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { latestUnauditedYearBlock, latestUnauditedYearKey, type ComrepProfileCompleteness } from "@cashsouk/types";
import {
  ProfileFinancialSaveBar,
  ProfileFinancialStatementsBody,
  profileFinancialDraftFromValues,
  validateProfileFinancialDraft,
} from "@cashsouk/ui";
import { ProfileCard, ProfileEditToggle } from "./profile-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function IssuerFinancialsCard({ organizationId }: { organizationId: string }) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["issuer", "latest-financials", organizationId],
    queryFn: async () => {
      const res = await api.getIssuerLatestFinancialStatements(organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });
  const completenessQuery = useQuery({
    queryKey: ["issuer", "profile-completeness", organizationId],
    queryFn: async () => {
      const res = await api.getProfileCompleteness("issuer", organizationId);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const statements = query.data?.financial_statements;
  const year = latestUnauditedYearKey(statements);
  const yearBlock = latestUnauditedYearBlock(statements);
  const editorYear = year ?? String(new Date().getFullYear() - 1);
  const completeness: ComrepProfileCompleteness | undefined = completenessQuery.data;
  const financialStep = completeness?.steps.find((step) => step.id === "financials");
  const complete = financialStep?.complete ?? false;
  const missingCount = financialStep?.missing.length ?? 0;

  React.useEffect(() => {
    if (isEditing) return;
    setDraft(profileFinancialDraftFromValues(yearBlock));
    setFieldErrors({});
  }, [isEditing, yearBlock]);

  const save = useMutation({
    mutationFn: async () => {
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
      const res = await api.patchIssuerOrgFinancials(organizationId, editorYear, result.fields);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issuer", "latest-financials", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", organizationId] });
      toast.success("Financials saved");
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ProfileCard
      id="profile-financials"
      title="Financial Statements"
      description={year ? `FY${year} on your company profile.` : "Latest financial statements for this company"}
      action={
        <ProfileEditToggle
          canEdit
          isEditing={isEditing}
          onEdit={() => {
            setDraft(profileFinancialDraftFromValues(yearBlock));
            setFieldErrors({});
            setIsEditing(true);
          }}
          onCancel={() => {
            setDraft(profileFinancialDraftFromValues(yearBlock));
            setFieldErrors({});
            setIsEditing(false);
          }}
        />
      }
    >
      <ProfileFinancialStatementsBody
        yearLabel={yearBlock && year ? `FY${year}` : null}
        values={yearBlock ?? null}
        isEditing={isEditing}
        draft={draft}
        fieldErrors={fieldErrors}
        missingCount={missingCount}
        complete={complete}
        onDraftChange={(key, value) => {
          setDraft((current) => ({ ...current, [key]: value }));
          setFieldErrors((current) => ({ ...current, [key]: "" }));
        }}
      />
      {isEditing ? (
        <ProfileFinancialSaveBar
          className="mt-6"
          isSaving={save.isPending}
          onCancel={() => {
            setDraft(profileFinancialDraftFromValues(yearBlock));
            setFieldErrors({});
            setIsEditing(false);
          }}
          onSave={() => save.mutate()}
        />
      ) : null}
    </ProfileCard>
  );
}
