"use client";

import * as React from "react";
import { UserGroupIcon, UserIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  canEnterEmailForDirectorShareholder,
  filterVisiblePeopleRows,
  getDirectorShareholderSingleStatusPresentation,
  getDirectorShareholderStatusTooltip,
  getDisplayRoleLabel,
  normalizeDirectorShareholderIdKey,
  normalizeDirectorShareholderPartyEmail,
  type ApplicationPersonRow,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface DirectorShareholdersUnifiedSectionProps {
  organizationId?: string;
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  className?: string;
  highlightActionRequiredRows?: boolean;
  autoFocusFirstEmptyEmail?: boolean;
  focusedMatchKey?: string | null;
}

type AugmentedRow = DirectorShareholderDisplayRow & { __person: ApplicationPersonRow };

function isDirectorLikeRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  return Boolean(r.isDirector);
}

function isIndividualShareholderOnlyRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  return !Boolean(r.isDirector) && Boolean(r.isShareholder);
}

function roleLabel(row: AugmentedRow): string {
  if (row.type === "COMPANY") return row.role || "Corporate Shareholder";
  return (
    getDisplayRoleLabel({
      isDirector: row.isDirector ?? false,
      isShareholder: row.isShareholder ?? false,
      sharePercentage: row.sharePercentage,
    }) || row.role
  );
}

export function DirectorShareholdersUnifiedSection({
  organizationId,
  organizationOnboardingStatus = null,
  people,
  className,
  highlightActionRequiredRows = true,
  autoFocusFirstEmptyEmail = false,
  focusedMatchKey = null,
}: DirectorShareholdersUnifiedSectionProps) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [confirmRow, setConfirmRow] = React.useState<AugmentedRow | null>(null);
  const [savePending, setSavePending] = React.useState(false);

  const blockPartyOnboarding = Boolean(organizationId) && organizationOnboardingStatus !== "COMPLETED";

  const rows = React.useMemo(
    () =>
      filterVisiblePeopleRows(people).map((p) => ({
        ...buildDirectorShareholderDisplayRowForEmailEligibility(p, null),
        __person: p,
      })),
    [people]
  );

  React.useEffect(() => {
    if (!autoFocusFirstEmptyEmail) return;
    const t = window.setTimeout(() => {
      const nodes = document.querySelectorAll<HTMLInputElement>("[data-profile-director-email]");
      for (const input of nodes) {
        if (!input.value.trim()) {
          input.focus();
          return;
        }
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [autoFocusFirstEmptyEmail, rows]);

  React.useEffect(() => {
    const norm = normalizeDirectorShareholderIdKey(focusedMatchKey ?? "");
    if (!norm) return;
    const el = document.querySelector<HTMLElement>(`[data-person-key="${norm}"]`);
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary", "ring-offset-2");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-primary", "ring-offset-2");
      }, 1800);
    }, 220);
    return () => window.clearTimeout(t);
  }, [focusedMatchKey, rows]);

  const displayEmail = React.useCallback((row: AugmentedRow) => draftEmails[row.id] ?? row.email ?? "", [draftEmails]);

  const canSendForRow = React.useCallback(
    (row: AugmentedRow) => !blockPartyOnboarding && canEnterEmailForDirectorShareholder(row.__person),
    [blockPartyOnboarding]
  );

  const commitSend = async () => {
    if (!confirmRow) return;
    const email = displayEmail(confirmRow).trim();
    const partyKey = confirmRow.__person.matchKey;
    if (!email || !partyKey) {
      toast.error("Enter a valid email and ensure the row has IC or SSM.");
      return;
    }
    const nextEmailNorm = normalizeDirectorShareholderPartyEmail(email);
    for (const r of rows) {
      if (r.id === confirmRow.id) continue;
      if (r.type !== "INDIVIDUAL") continue;
      if (!canSendForRow(r)) continue;
      if (normalizeDirectorShareholderPartyEmail(displayEmail(r)) === nextEmailNorm) {
        toast.error("Email already used for another director/shareholder");
        return;
      }
    }
    if (!organizationId) {
      setConfirmRow(null);
      return;
    }
    setSavePending(true);
    try {
      const saveRes = await apiClient.patch<{ success: boolean }>(
        `/v1/organizations/issuer/${organizationId}/ctos-party-email`,
        { partyKey, email }
      );
      if (!saveRes.success) {
        toast.error(saveRes.error.message);
        return;
      }
      const sendRes = await apiClient.post<{ requestId: string }>(
        `/v1/organizations/issuer/${organizationId}/send-director-onboarding`,
        { partyKey }
      );
      if (!sendRes.success) {
        toast.error(sendRes.error.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["corporate-entities", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      toast.success("Email saved and onboarding link sent");
      setConfirmRow(null);
    } finally {
      setSavePending(false);
    }
  };

  const directorLikeRows = rows.filter(isDirectorLikeRow);
  const shareholderOnlyRows = rows.filter(isIndividualShareholderOnlyRow);
  const corporateRows = rows.filter((r) => r.type === "COMPANY");
  const emptyAll = directorLikeRows.length === 0 && shareholderOnlyRows.length === 0 && corporateRows.length === 0;

  const renderRow = (row: AugmentedRow) => {
    const email = displayEmail(row);
    const showSend = canSendForRow(row);
    const showActionCue = highlightActionRequiredRows && showSend && !email.trim();
    const statusPresentation = getDirectorShareholderSingleStatusPresentation({
      screening: row.__person.screening,
      onboarding: row.__person.onboarding,
    });
    return (
      <div
        key={row.id}
        data-person-key={normalizeDirectorShareholderIdKey(row.__person.matchKey) ?? undefined}
        data-action-required={showActionCue ? "true" : undefined}
        className="flex flex-col gap-3 p-4 rounded-lg border border-border bg-muted/30 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {row.name}
            {row.idNumber?.trim() ? <span className="font-normal text-muted-foreground"> · IC {row.idNumber}</span> : null}
          </p>
          {email.trim() ? <p className="text-xs text-muted-foreground mt-1 break-all">{email}</p> : null}
          <p className="text-xs text-muted-foreground mt-1">{roleLabel(row)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {statusPresentation ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={cn("border-transparent text-[11px] font-normal", statusPresentation.badgeClassName)}
                  >
                    {statusPresentation.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{getDirectorShareholderStatusTooltip(statusPresentation.label)}</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {showSend ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
            <Input
              type="email"
              data-profile-director-email
              className="h-11 max-w-full rounded-xl border-2 border-input bg-background sm:max-w-xs"
              placeholder="Email"
              value={email}
              disabled={savePending}
              onChange={(e) => setDraftEmails((prev) => ({ ...prev, [row.id]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              className="w-full rounded-xl sm:w-auto"
              disabled={savePending || !email.trim()}
              onClick={() => setConfirmRow(row)}
            >
              Confirm & Send
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h2 className="text-lg font-semibold">Directors and Shareholders</h2>
          <p className="text-sm text-muted-foreground">Directors and shareholders details</p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {emptyAll ? (
          <p className="text-sm text-muted-foreground text-center py-8">No directors or shareholders listed.</p>
        ) : (
          <>
            {directorLikeRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserGroupIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Directors / Controllers / Authorised Personnel</h3>
                </div>
                <div className="space-y-3">{directorLikeRows.map(renderRow)}</div>
              </div>
            ) : null}
            {shareholderOnlyRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Individual Shareholders / Ultimate Beneficiaries</h3>
                </div>
                <div className="space-y-3">{shareholderOnlyRows.map(renderRow)}</div>
              </div>
            ) : null}
            {corporateRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Business Shareholders / Beneficiaries</h3>
                </div>
                <div className="space-y-3">{corporateRows.map(renderRow)}</div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={confirmRow != null} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Send onboarding link</DialogTitle>
            <DialogDescription>
              {confirmRow ? `Save email and send onboarding link to ${confirmRow.name}.` : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-lg" disabled={savePending} onClick={() => setConfirmRow(null)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-lg" onClick={() => void commitSend()} disabled={savePending || !confirmRow}>
              {savePending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
