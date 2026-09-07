"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
  firstIssueMessage,
  isIssuerFinancialFieldRequired,
  issuesByField,
  latestUnauditedYearBlock,
  latestUnauditedYearKey,
  SC_MONTHLY_ISSUER_FINANCIAL_HELP,
  SC_MONTHLY_ISSUER_FINANCIAL_LABELS,
  validateIssuerFinancialFields,
  type ComrepProfileCompleteness,
} from "@cashsouk/types";
import { ComRepFieldLabel, ProfileFieldGrid, ProfileReadField, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileCard } from "./profile-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const EDITABLE_KEYS = [...ISSUER_PROFILE_BALANCE_SHEET_KEYS, ...ISSUER_PROFILE_PNL_KEYS] as const;

function fieldLabel(key: string): string {
  return SC_MONTHLY_ISSUER_FINANCIAL_LABELS[key] ?? key;
}

function fieldHelp(key: string): string | undefined {
  return SC_MONTHLY_ISSUER_FINANCIAL_HELP[key];
}

function fieldRequired(key: string): boolean {
  return isIssuerFinancialFieldRequired(key);
}

export function IssuerFinancialsCard({ organizationId }: { organizationId: string }) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
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
  const year = latestUnauditedYearKey(statements) ?? String(new Date().getFullYear() - 1);
  const yearBlock = latestUnauditedYearBlock(statements);
  const completeness: ComrepProfileCompleteness | undefined = completenessQuery.data;
  const financialStep = completeness?.steps.find((step) => step.id === "financials");
  const complete = financialStep?.complete ?? false;
  const missingCount = financialStep?.missing.length ?? 0;

  React.useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const key of EDITABLE_KEYS) {
      const current = yearBlock?.[key];
      next[key] = current == null ? "" : String(current);
    }
    setDraft(next);
    setFieldErrors({});
  }, [open, yearBlock]);

  const save = useMutation({
    mutationFn: async () => {
      const fields: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(draft)) {
        fields[key] = value.trim() === "" ? null : value.trim();
      }
      const issues = validateIssuerFinancialFields(fields);
      if (issues.length > 0) {
        setFieldErrors(issuesByField(issues));
        throw new Error(firstIssueMessage(issues) ?? "Please complete the required financial fields.");
      }
      setFieldErrors({});
      const res = await api.patchIssuerOrgFinancials(organizationId, year, fields);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issuer", "latest-financials", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["issuer", "profile-completeness", organizationId] });
      toast.success("Financials saved");
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ProfileCard
      id="profile-financials"
      title="Financials"
      description="Latest issuer financial statements"
      action={
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
          {complete ? "View / Edit financials" : "Complete"}
        </Button>
      }
    >
      <ProfileFieldGrid>
        <ProfileReadField label="Latest Financial Year" value={year ? `FY${year}` : "—"} />
        <ProfileReadField
          label="Status"
          value={
            complete ? (
              <StatusBadge status="success" label="Complete" />
            ) : (
              <StatusBadge
                status="action"
                label={
                  missingCount
                    ? `${missingCount} required ${missingCount === 1 ? "field" : "fields"} missing`
                    : "Missing fields"
                }
              />
            )
          }
        />
      </ProfileFieldGrid>
      <div className="mt-4">
        <Button type="button" className="h-10 rounded-xl" onClick={() => setOpen(true)}>
          {complete ? "View / Edit financials" : "Complete financials"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Financial statements</DialogTitle>
            <DialogDescription>
              {year ? `FY${year} on your company profile.` : "Enter figures for the latest financial year."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-card-title">Balance sheet</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {ISSUER_PROFILE_BALANCE_SHEET_KEYS.map((key) => {
                  const required = fieldRequired(key);
                  const error = fieldErrors[key];
                  return (
                    <div key={key} className="space-y-2">
                      <ComRepFieldLabel
                        label={fieldLabel(key)}
                        required={required}
                        help={fieldHelp(key)}
                      />
                      <Input
                        className="h-11 text-ui"
                        value={draft[key] ?? ""}
                        onChange={(event) => {
                          setDraft((current) => ({ ...current, [key]: event.target.value }));
                          setFieldErrors((current) => ({ ...current, [key]: "" }));
                        }}
                      />
                      {error ? <p className="text-meta text-destructive">{error}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-card-title">Profit and loss</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {ISSUER_PROFILE_PNL_KEYS.map((key) => {
                  const required = fieldRequired(key);
                  const error = fieldErrors[key];
                  return (
                    <div key={key} className="space-y-2">
                      <ComRepFieldLabel
                        label={fieldLabel(key)}
                        required={required}
                        help={fieldHelp(key)}
                      />
                      <Input
                        className="h-11 text-ui"
                        value={draft[key] ?? ""}
                        onChange={(event) => {
                          setDraft((current) => ({ ...current, [key]: event.target.value }));
                          setFieldErrors((current) => ({ ...current, [key]: "" }));
                        }}
                      />
                      {error ? <p className="text-meta text-destructive">{error}</p> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              className="h-10"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProfileCard>
  );
}
