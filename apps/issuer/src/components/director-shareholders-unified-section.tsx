"use client";

import * as React from "react";
import {
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  getDirectorShareholderDisplayRows,
  getDisplayRoleLabel,
  isCtosIndividualKycEligibleRow,
  normalizeDirectorShareholderIdKey,
  regtankDisplayStatusBadgeClass,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface DirectorShareholdersUnifiedSectionProps {
  organizationId?: string;
  corporateEntities: unknown;
  directorKycStatus: unknown;
  directorAmlStatus?: unknown;
  organizationCtosCompanyJson?: unknown | null;
  ctosPartySupplements?: { partyKey: string; onboardingJson?: unknown }[] | null;
  className?: string;
  /** Highlight rows with Not Started KYC or empty email (issuer profile). */
  highlightActionRequiredRows?: boolean;
  /** After navigation from company details; focuses first visible empty email field. */
  autoFocusFirstEmptyEmail?: boolean;
}

function roleLower(r: DirectorShareholderDisplayRow): string {
  return r.role.toLowerCase();
}

function personRoleDisplayLabel(row: DirectorShareholderDisplayRow): string {
  if (row.type === "COMPANY") return row.role;
  if (typeof row.isDirector === "boolean" || typeof row.isShareholder === "boolean") {
    const fromFlags = getDisplayRoleLabel({
      isDirector: row.isDirector ?? false,
      isShareholder: row.isShareholder ?? false,
      sharePercentage: row.sharePercentage,
    });
    if (fromFlags.trim()) return fromFlags;
  }
  return row.role;
}

function isDirectorLikeRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  if (typeof r.isDirector === "boolean") return r.isDirector;
  return roleLower(r).includes("director");
}

function isIndividualShareholderOnlyRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  if (typeof r.isDirector === "boolean") return !r.isDirector && Boolean(r.isShareholder);
  return !roleLower(r).includes("director");
}

function onboardingLinkSentForRow(row: DirectorShareholderDisplayRow): boolean {
  return row.ctosOnboardingLinkSent === true || row.status === "Sent";
}

/** `row.status` is always unified KYC display (CTOS or legacy). */
function ctosKycStatusUiFromRow(row: DirectorShareholderDisplayRow): { display: string; badgeClass: string } {
  return { display: row.status, badgeClass: regtankDisplayStatusBadgeClass(row.status) };
}

function partyKeyRawForRow(row: DirectorShareholderDisplayRow): string {
  return (
    row.registrationNumber?.trim() ||
    row.idNumber?.trim() ||
    row.enquiryId?.trim() ||
    ""
  );
}

function rowNeedsProfileAction(
  row: DirectorShareholderDisplayRow,
  emailDisplay: string
): boolean {
  return !emailDisplay.trim() || row.status === "Not Started";
}

function onboardingApprovalLockActive(onboardingJson: unknown): boolean {
  if (!onboardingJson || typeof onboardingJson !== "object" || Array.isArray(onboardingJson)) return false;
  const onboarding = onboardingJson as Record<string, unknown>;
  const regtankStatus = String(onboarding.regtankStatus ?? "").trim().toUpperCase();
  const kycRawStatus =
    onboarding.kyc && typeof onboarding.kyc === "object" && !Array.isArray(onboarding.kyc)
      ? String((onboarding.kyc as Record<string, unknown>).rawStatus ?? "").trim().toUpperCase()
      : "";
  return regtankStatus === "APPROVED" || kycRawStatus === "APPROVED";
}

function isRowComplete(row: DirectorShareholderDisplayRow, persistedEmail: string): boolean {
  return Boolean(persistedEmail?.trim()) && row.status !== "Not Started";
}

/** Persisted save complete, or local preview after confirm (no API) when row shows sent + email. */
function isRowCompleteForUi(
  row: DirectorShareholderDisplayRow,
  persistedEmail: string,
  displayEmailStr: string,
  sentIds: ReadonlySet<string>
): boolean {
  if (isRowComplete(row, persistedEmail)) return true;
  return (
    sentIds.has(row.id) &&
    Boolean(displayEmailStr.trim()) &&
    row.status !== "Not Started"
  );
}

export function DirectorShareholdersUnifiedSection({
  organizationId,
  corporateEntities,
  directorKycStatus,
  directorAmlStatus,
  organizationCtosCompanyJson,
  ctosPartySupplements,
  className,
  highlightActionRequiredRows = true,
  autoFocusFirstEmptyEmail = false,
}: DirectorShareholdersUnifiedSectionProps) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = React.useMemo(
    () => createApiClient(API_URL, getAccessToken),
    [getAccessToken]
  );

  const [sentRowIds, setSentRowIds] = React.useState<Set<string>>(() => new Set());
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [confirmRow, setConfirmRow] = React.useState<DirectorShareholderDisplayRow | null>(null);
  const [savePending, setSavePending] = React.useState(false);

  const rows = React.useMemo(
    () =>
      getDirectorShareholderDisplayRows({
        corporateEntities,
        directorKycStatus,
        directorAmlStatus: directorAmlStatus ?? null,
        organizationCtosCompanyJson,
        ctosPartySupplements: ctosPartySupplements ?? null,
        sentRowIds,
      }),
    [
      corporateEntities,
      directorKycStatus,
      directorAmlStatus,
      organizationCtosCompanyJson,
      ctosPartySupplements,
      sentRowIds,
    ]
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

  const directorLikeRows = React.useMemo(() => rows.filter(isDirectorLikeRow), [rows]);
  const shareholderOnlyRows = React.useMemo(() => rows.filter(isIndividualShareholderOnlyRow), [rows]);
  const corporateRows = React.useMemo(() => rows.filter((r) => r.type === "COMPANY"), [rows]);

  const displayEmail = React.useCallback(
    (row: DirectorShareholderDisplayRow) => {
      const d = draftEmails[row.id];
      if (d !== undefined) return d;
      return row.email;
    },
    [draftEmails]
  );

  const supplementByPartyKey = React.useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    for (const row of ctosPartySupplements ?? []) {
      const key = normalizeDirectorShareholderIdKey(row.partyKey);
      if (!key) continue;
      const onboarding =
        row.onboardingJson && typeof row.onboardingJson === "object" && !Array.isArray(row.onboardingJson)
          ? (row.onboardingJson as Record<string, unknown>)
          : {};
      map.set(key, onboarding);
    }
    return map;
  }, [ctosPartySupplements]);

  const commitSend = async () => {
    if (!confirmRow) return;
    if (!isCtosIndividualKycEligibleRow(confirmRow)) {
      toast.error("Individual onboarding is not required for this party.");
      setConfirmRow(null);
      return;
    }
    const email = displayEmail(confirmRow).trim();
    const rawKey = partyKeyRawForRow(confirmRow);
    const partyKeyNorm = normalizeDirectorShareholderIdKey(rawKey);
    const latestOnboarding = partyKeyNorm ? supplementByPartyKey.get(partyKeyNorm) : undefined;
    const hadRequestId = String(latestOnboarding?.requestId ?? "").trim().length > 0;
    if (!email || !partyKeyNorm) {
      toast.error("Enter a valid email and ensure the row has an IC or SSM number.");
      return;
    }
    if (!organizationId) {
      if (email) setDraftEmails((prev) => ({ ...prev, [confirmRow.id]: email }));
      setSentRowIds((prev) => new Set(prev).add(confirmRow.id));
      setConfirmRow(null);
      return;
    }
    setSavePending(true);
    try {
      const res = await apiClient.patch<{ success: boolean }>(
        `/v1/organizations/issuer/${organizationId}/ctos-party-email`,
        { partyKey: rawKey, email }
      );
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      const sendRes = await apiClient.post<{ requestId: string }>(
        `/v1/organizations/issuer/${organizationId}/send-director-onboarding`,
        { partyKey: rawKey }
      );
      if (!sendRes.success) {
        toast.error(sendRes.error.message);
        await queryClient.invalidateQueries({ queryKey: ["corporate-entities", organizationId] });
        await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["corporate-entities", organizationId] });
      await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      setDraftEmails((prev) => {
        const next = { ...prev };
        delete next[confirmRow.id];
        return next;
      });
      toast.success(
        hadRequestId
          ? "Email saved and onboarding restarted"
          : "Email saved and onboarding link sent"
      );
      setConfirmRow(null);
    } finally {
      setSavePending(false);
    }
  };

  const renderPersonRow = (row: DirectorShareholderDisplayRow) => {
    const ic = row.idNumber?.trim();
    const em = displayEmail(row);
    const persistedEmail = row.email;
    const linkSent = onboardingLinkSentForRow(row);
    const partyKeyNorm = normalizeDirectorShareholderIdKey(partyKeyRawForRow(row));
    const latestOnboarding = partyKeyNorm ? supplementByPartyKey.get(partyKeyNorm) : undefined;
    const latestRequestId = String(latestOnboarding?.requestId ?? "").trim();
    const latestVerifyLink = String(latestOnboarding?.verifyLink ?? "").trim();
    const approvalLocked = onboardingApprovalLockActive(latestOnboarding);
    const kycUi = ctosKycStatusUiFromRow(row);
    const completedUx = isRowCompleteForUi(row, persistedEmail, em, sentRowIds);
    const kycEligible = isCtosIndividualKycEligibleRow(row);
    const showEmailControls = kycEligible && !approvalLocked;
    const needsAction = kycEligible && rowNeedsProfileAction(row, em) && !linkSent;
    const rowHighlight =
      highlightActionRequiredRows && kycEligible && !completedUx && !linkSent && needsAction;
    const rowSentVisual =
      linkSent &&
      "border-sky-300/80 bg-sky-50/70 ring-1 ring-sky-200/80 dark:border-sky-800 dark:bg-sky-950/25 dark:ring-sky-900/50";
    const rowCompleteVisual =
      !linkSent &&
      completedUx &&
      "border-emerald-300/80 bg-emerald-50/70 ring-1 ring-emerald-200/80 dark:border-emerald-800 dark:bg-emerald-950/25 dark:ring-emerald-900/50";

    return (
      <div
        key={row.id}
        className={cn(
          "flex flex-col gap-3 p-4 rounded-lg border bg-muted/30 sm:flex-row sm:items-start sm:justify-between",
          rowHighlight &&
            "border-amber-300/90 bg-amber-50/80 ring-1 ring-amber-200/90 dark:border-amber-800 dark:bg-amber-950/30 dark:ring-amber-900/60",
          rowSentVisual,
          rowCompleteVisual
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {row.name}
            {ic ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · IC {ic}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{em.trim() ? em : "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">{personRoleDisplayLabel(row)}</p>
          {row.ownershipDisplay?.trim() ? (
            <p className="text-xs text-muted-foreground mt-1">{row.ownershipDisplay}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">KYC</span>
              <Badge className={cn("text-xs font-medium", kycUi.badgeClass)}>{kycUi.display}</Badge>
            </div>
            {row.amlStatus?.trim() ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">AML</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {row.amlStatus}
                </Badge>
              </div>
            ) : null}
          </div>
          {latestRequestId ? (
            <p className="text-xs text-muted-foreground mt-1">Latest request ID: {latestRequestId}</p>
          ) : null}
          {showEmailControls && latestRequestId ? (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              This will restart onboarding and discard previous progress.
            </p>
          ) : null}
        </div>
        {approvalLocked ? (
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">KYC approved</span>
          </div>
        ) : completedUx && !showEmailControls ? (
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Completed</span>
          </div>
        ) : showEmailControls ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
            <Input
              type="email"
              data-profile-director-email
              className="h-11 max-w-full rounded-xl border-2 border-input bg-background sm:max-w-xs"
              placeholder="Email"
              value={em}
              disabled={savePending}
              onChange={(e) => setDraftEmails((prev) => ({ ...prev, [row.id]: e.target.value }))}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full gap-2 rounded-xl sm:w-auto"
              disabled={savePending || !em.trim()}
              onClick={() => setConfirmRow(row)}
            >
              Confirm & Send
            </Button>
            {latestVerifyLink ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full rounded-xl sm:w-auto"
                disabled={savePending}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(latestVerifyLink);
                    toast.success("Onboarding link copied");
                  } catch {
                    toast.error("Failed to copy onboarding link");
                  }
                }}
              >
                Copy link
              </Button>
            ) : null}
            {linkSent ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full rounded-xl sm:w-auto"
                disabled={savePending}
                onClick={() => setDraftEmails((prev) => ({ ...prev, [row.id]: "" }))}
              >
                Send to a different email
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCorpRow = (row: DirectorShareholderDisplayRow) => {
    const persistedEmail = row.email;
    const linkSent = onboardingLinkSentForRow(row);
    const kycUi = ctosKycStatusUiFromRow(row);
    const completedUx = isRowCompleteForUi(row, persistedEmail, persistedEmail, sentRowIds);
    const rowSentVisual =
      linkSent &&
      "border-sky-300/80 bg-sky-50/70 ring-1 ring-sky-200/80 dark:border-sky-800 dark:bg-sky-950/25 dark:ring-sky-900/50";
    const rowCompleteVisual =
      !linkSent &&
      completedUx &&
      "border-emerald-300/80 bg-emerald-50/70 ring-1 ring-emerald-200/80 dark:border-emerald-800 dark:bg-emerald-950/25 dark:ring-emerald-900/50";
    return (
      <div
        key={row.id}
        className={cn(
          "flex flex-col gap-3 p-4 rounded-lg border bg-muted/30 sm:flex-row sm:items-center sm:justify-between",
          rowSentVisual,
          rowCompleteVisual
        )}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{row.name}</p>
          {row.registrationNumber?.trim() ? (
            <p className="text-xs text-muted-foreground mt-1">SSM {row.registrationNumber}</p>
          ) : null}
          <p className="text-xs text-muted-foreground mt-1">
            {row.ownershipDisplay?.trim() ? row.ownershipDisplay : "Shareholder"}
          </p>
          <div className="mt-1 flex flex-wrap flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">KYC</span>
              <Badge className={cn("text-xs font-medium", kycUi.badgeClass)}>{kycUi.display}</Badge>
            </div>
            {row.amlStatus?.trim() ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">AML</span>
                <Badge variant="outline" className="text-xs font-medium">
                  {row.amlStatus}
                </Badge>
              </div>
            ) : null}
          </div>
        </div>
        {linkSent ? null : completedUx ? (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Completed</span>
          </div>
        ) : null}
      </div>
    );
  };

  const emptyAll =
    directorLikeRows.length === 0 && shareholderOnlyRows.length === 0 && corporateRows.length === 0;

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
                <div className="space-y-3">{directorLikeRows.map(renderPersonRow)}</div>
              </div>
            ) : null}

            {shareholderOnlyRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Individual Shareholders / Ultimate Beneficiaries</h3>
                </div>
                <div className="space-y-3">{shareholderOnlyRows.map(renderPersonRow)}</div>
              </div>
            ) : null}

            {corporateRows.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <BuildingOffice2Icon className="h-5 w-5 text-muted-foreground" />
                  <h3 className="text-base font-semibold">Business Shareholders / Beneficiaries</h3>
                </div>
                <div className="space-y-3">{corporateRows.map(renderCorpRow)}</div>
                <p className="text-xs text-muted-foreground">
                  Corporate shareholders/beneficiaries associated with your organization.
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={confirmRow != null} onOpenChange={(open: boolean) => !open && setConfirmRow(null)}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Send onboarding link</DialogTitle>
            <DialogDescription>
              {confirmRow
                ? `Save email and send a RegTank onboarding link to ${confirmRow.name}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              disabled={savePending}
              onClick={() => setConfirmRow(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg"
              onClick={() => void commitSend()}
              disabled={savePending || !confirmRow || !displayEmail(confirmRow).trim()}
            >
              {savePending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
