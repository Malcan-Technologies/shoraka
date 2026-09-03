"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  latestUnauditedYearBlock,
  latestUnauditedYearKey,
  type ComrepProfileCompleteness,
} from "@cashsouk/types";
import { ProfileFieldGrid, ProfileReadField, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EDITABLE_KEYS = [
  "bscatot",
  "bsclbank",
  "curlib_borrowing",
  "curlib_non_borrowing",
  "ncl_loan",
  "ncl_non_loan",
  "bsqpuc",
  "equity_accumulated_profit",
  "turnover",
  "operating_cost",
  "admin_cost",
  "interest_cost",
  "other_cost",
  "plnpbt",
  "plnpat",
  "plnetdiv",
] as const;

const MISSING_TO_KEY: Record<string, string> = {
  currentAssets: "bscatot",
  nonCurrentAssets: "bsclbank",
  currentBorrowing: "curlib_borrowing",
  currentNonBorrowing: "curlib_non_borrowing",
  nonCurrentLoan: "ncl_loan",
  nonCurrentNonLoan: "ncl_non_loan",
  equityCapital: "bsqpuc",
  accumulatedProfit: "equity_accumulated_profit",
  revenue: "turnover",
  operatingCost: "operating_cost",
  adminCost: "admin_cost",
  interestCost: "interest_cost",
  otherCost: "other_cost",
  profitBeforeTax: "plnpbt",
  profitAfterTax: "plnpat",
  netDividend: "plnetdiv",
};

function fieldLabel(key: string): string {
  return FINANCIAL_FIELD_LABELS[key] ?? key;
}

export function IssuerFinancialsCard({ organizationId }: { organizationId: string }) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
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
  const missingKeys = new Set(
    (financialStep?.missing ?? []).map((item) =>
      item.field === "financials" ? item.field : MISSING_TO_KEY[item.field] ?? item.field
    )
  );

  React.useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const key of EDITABLE_KEYS) {
      const current = yearBlock?.[key];
      next[key] = current == null ? "" : String(current);
    }
    setDraft(next);
  }, [open, yearBlock]);

  const save = useMutation({
    mutationFn: async () => {
      const fields: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(draft)) {
        fields[key] = value.trim() === "" ? null : value.trim();
      }
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
          <div className="grid gap-4 sm:grid-cols-2">
            {EDITABLE_KEYS.map((key) => {
              const required = missingKeys.has(key) || missingKeys.has("financials");
              const empty = !(draft[key] ?? "").trim();
              return (
                <div key={key} className="space-y-2">
                  <Label className="text-ui font-medium">{fieldLabel(key)}</Label>
                  <Input
                    className="h-11 text-ui"
                    value={draft[key] ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                  {required && empty ? (
                    <p className="text-meta text-status-action-text">Required</p>
                  ) : null}
                </div>
              );
            })}
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
