"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  type IssuerOrgFinancialSummary,
  type OrganizationDetailResponse,
} from "@cashsouk/types";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { StatusBadge } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/hooks/use-permissions";
import { missingFieldKeys } from "@/organizations/utils/organization-profile-overview";

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

function fieldLabel(key: string): string {
  return FINANCIAL_FIELD_LABELS[key] ?? key;
}

function displayAmount(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

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
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const missing = missingFieldKeys(org.profileCompleteness, "financials");

  React.useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const key of EDITABLE_KEYS) {
      const current = financials?.fields?.[key];
      next[key] = current == null ? "" : String(current);
    }
    setDraft(next);
  }, [open, financials]);

  const save = useMutation({
    mutationFn: async () => {
      const year = financials?.latestYear || String(new Date().getFullYear() - 1);
      const fields: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(draft)) {
        fields[key] = value.trim() === "" ? null : value.trim();
      }
      const res = await api.patchAdminIssuerFinancials(organizationId, year, fields);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["admin", "organization-detail", "issuer", organizationId],
      });
      toast.success("Financials updated");
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const latestYear = financials?.latestYear;
  const complete = financials?.complete ?? missing.size === 0;
  const status: IssuerOrgFinancialSummary | null = financials;

  return (
    <Card id="profile-financials" className="rounded-2xl">
      <AdminDetailCardHeader
        icon={BanknotesIcon}
        title="Financials"
        description="Latest issuer financial statements on the CashSouk master record"
        actions={
          canManage ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              {status?.fields ? "Edit" : "Add"}
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 py-2">
            <p className="text-meta text-muted-foreground">Latest financial year</p>
            <p className="text-ui font-medium">{latestYear ? `FY${latestYear}` : "—"}</p>
          </div>
          <div className="space-y-1.5 py-2">
            <p className="text-meta text-muted-foreground">Status</p>
            {complete ? (
              <StatusBadge status="success" label="Complete" />
            ) : (
              <StatusBadge
                status="action"
                label={
                  status?.missingCount
                    ? `${status.missingCount} missing fields`
                    : "Missing fields"
                }
              />
            )}
          </div>
        </div>
        {status?.fields ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EDITABLE_KEYS.slice(0, 6).map((key) => (
              <div key={key} className="space-y-1 py-1">
                <p className="text-meta text-muted-foreground">{fieldLabel(key)}</p>
                <p className="text-ui font-medium">{displayAmount(status.fields?.[key])}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ui text-muted-foreground">No financial statements stored yet.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(true)}>
            View financials
          </Button>
          {canManage ? (
            <Button type="button" className="h-10" onClick={() => setOpen(true)}>
              Edit
            </Button>
          ) : null}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Financial statements</DialogTitle>
            <DialogDescription>
              {latestYear
                ? `FY${latestYear} on the CashSouk master record.`
                : "Enter figures for the latest financial year."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {EDITABLE_KEYS.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-ui">{fieldLabel(key)}</Label>
                <Input
                  className="h-10 text-ui"
                  value={draft[key] ?? ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [key]: event.target.value }))
                  }
                  disabled={!canManage}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => setOpen(false)}>
              Close
            </Button>
            {canManage ? (
              <Button
                type="button"
                className="h-10"
                onClick={() => save.mutate()}
                disabled={save.isPending}
              >
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
