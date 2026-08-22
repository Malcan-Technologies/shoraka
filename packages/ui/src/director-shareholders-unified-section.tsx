"use client";

import * as React from "react";
import { UserGroupIcon, UserIcon, BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  canManageDirectorShareholder,
  filterVisiblePeopleRows,
  formatPeopleIdentityLine,
  formatPeopleRolesLine,
  formatPeopleRolesLineTitleCase,
  getFinalStatusLabel,
  getFinalStatusToken,
  isMissingGovernmentIdPerson,
  normalizeDirectorShareholderIdKey,
  normalizeDirectorShareholderPartyEmail,
  resolveDirectorShareholderCtosEmptyWarning,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
  type ApplicationPersonRow,
  type DirectorShareholderDisplayRow,
  type DirectorShareholderListSource,
} from "@cashsouk/types";
import { toast } from "sonner";
import { DirectorShareholderCtosEmptyAlert } from "./director-shareholder-ctos-empty-alert";
import { DirectorShareholderUnresolvedIdentitySection } from "./director-shareholder-unresolved-identity-card";
import { Input } from "./components/input";
import { Button } from "./components/button";
import { StatusBadge } from "./components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./components/alert-dialog";
import { cn } from "./lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type DirectorShareholderPortal = "issuer" | "investor";

export interface DirectorShareholdersUnifiedSectionProps {
  portal?: DirectorShareholderPortal;
  organizationId?: string;
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  directorShareholderListSource?: DirectorShareholderListSource | null;
  ctosDirectorShareholderWarning?: string | null;
  className?: string;
  highlightActionRequiredRows?: boolean;
  autoFocusFirstEmptyEmail?: boolean;
  focusedMatchKey?: string | null;
  /** Called after email save + onboarding send succeed (e.g. invalidate org queries). */
  onPartyOnboardingSent?: () => void | Promise<void>;
}

type AugmentedRow = DirectorShareholderDisplayRow & { __person: ApplicationPersonRow };

function isDirectorLikeRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  return Boolean(r.isDirector);
}

function isIndividualShareholderOnlyRow(r: DirectorShareholderDisplayRow): boolean {
  if (r.type !== "INDIVIDUAL") return false;
  return !r.isDirector && Boolean(r.isShareholder);
}

export function directorShareholderOrgApiBase(
  portal: DirectorShareholderPortal,
  organizationId: string
): string {
  return `/v1/organizations/${portal}/${organizationId}`;
}

export function DirectorShareholdersUnifiedSection({
  portal = "issuer",
  organizationId,
  organizationOnboardingStatus = null,
  people,
  directorShareholderListSource = null,
  ctosDirectorShareholderWarning = null,
  className,
  highlightActionRequiredRows = true,
  autoFocusFirstEmptyEmail = false,
  focusedMatchKey = null,
  onPartyOnboardingSent,
}: DirectorShareholdersUnifiedSectionProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const [draftEmails, setDraftEmails] = React.useState<Record<string, string>>({});
  const [confirmRow, setConfirmRow] = React.useState<AugmentedRow | null>(null);
  const [savePending, setSavePending] = React.useState(false);
  const [recoverPendingKey, setRecoverPendingKey] = React.useState<string | null>(null);

  const resolvedCtosEmptyWarning = React.useMemo(
    () =>
      resolveDirectorShareholderCtosEmptyWarning({
        directorShareholderListSource,
        ctosDirectorShareholderWarning,
      }),
    [directorShareholderListSource, ctosDirectorShareholderWarning]
  );

  const blockPartyOnboarding = Boolean(organizationId) && organizationOnboardingStatus !== "COMPLETED";

  const rows = React.useMemo(
    () =>
      filterVisiblePeopleRows(people).map((p) => ({
        ...buildDirectorShareholderDisplayRowForEmailEligibility(p, null),
        __person: p,
      })),
    [people]
  );

  const unresolvedPeople = React.useMemo(
    () => filterVisiblePeopleRows(people).filter((p) => isMissingGovernmentIdPerson(p)),
    [people]
  );

  const verifiedRows = React.useMemo(
    () => rows.filter((r) => !isMissingGovernmentIdPerson(r.__person)),
    [rows]
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
    (row: AugmentedRow) => !blockPartyOnboarding && canManageDirectorShareholder(row.__person),
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
      const apiBase = directorShareholderOrgApiBase(portal, organizationId);
      const saveRes = await apiClient.patch<{ success: boolean }>(`${apiBase}/ctos-party-email`, {
        partyKey,
        email,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error.message);
        return;
      }
      const sendRes = await apiClient.post<{ requestId: string }>(`${apiBase}/send-director-onboarding`, {
        partyKey,
      });
      if (!sendRes.success) {
        toast.error(sendRes.error.message);
        return;
      }
      await onPartyOnboardingSent?.();
      toast.success("Email saved and onboarding link sent");
      setConfirmRow(null);
    } finally {
      setSavePending(false);
    }
  };

  const directorLikeRows = verifiedRows.filter(isDirectorLikeRow);
  const shareholderOnlyRows = verifiedRows.filter(isIndividualShareholderOnlyRow);
  const corporateRows = verifiedRows.filter((r) => r.type === "COMPANY");
  const emptyAll =
    directorLikeRows.length === 0 &&
    shareholderOnlyRows.length === 0 &&
    corporateRows.length === 0 &&
    unresolvedPeople.length === 0;

  const renderRow = (row: AugmentedRow) => {
    const email = displayEmail(row);
    const showSend = canSendForRow(row);
    const showActionCue = highlightActionRequiredRows && showSend && !email.trim();
    const finalStatus = getFinalStatusLabel({
      screening: row.__person.screening,
      onboarding: row.__person.onboarding,
    });
    const identityLine = formatPeopleIdentityLine(row.__person);
    const rolesLine = formatPeopleRolesLineTitleCase({
      roles: row.__person.roles ?? [],
      sharePercentage: row.__person.sharePercentage ?? null,
    });
    return (
      <div
        key={row.id}
        data-person-key={normalizeDirectorShareholderIdKey(row.__person.matchKey) ?? undefined}
        data-action-required={showActionCue ? "true" : undefined}
        className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-ui font-medium text-foreground">{row.name}</p>
          {identityLine ? (
            <p className="font-mono text-meta text-muted-foreground">{identityLine}</p>
          ) : null}
          {email.trim() ? <p className="text-meta text-muted-foreground break-all">{email}</p> : null}
          <p className="text-meta text-muted-foreground">{rolesLine || "—"}</p>
          <div className="pt-0.5">
            <StatusBadge
              label={finalStatus.label}
              status={getFinalStatusToken(finalStatus.tone)}
              size="sm"
            />
          </div>
        </div>
        {showSend ? (
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-56 sm:min-w-[14rem]">
            <Input
              type="email"
              data-profile-director-email
              className="w-full"
              placeholder="Email"
              value={email}
              disabled={savePending}
              onChange={(e) => setDraftEmails((prev) => ({ ...prev, [row.id]: e.target.value }))}
            />
            <Button
              type="button"
              className="w-full shrink-0"
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
          <p className="text-ui text-muted-foreground">Directors and shareholders details</p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {resolvedCtosEmptyWarning ? (
          <DirectorShareholderCtosEmptyAlert message={resolvedCtosEmptyWarning} />
        ) : null}
        {emptyAll ? (
          <p className="text-ui text-muted-foreground text-center py-8">
            {resolvedCtosEmptyWarning
              ? "No directors or shareholders are available from CTOS."
              : "No directors or shareholders listed."}
          </p>
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
            {unresolvedPeople.length > 0 ? (
              <DirectorShareholderUnresolvedIdentitySection
                noticeTitle={UNRESOLVED_IDENTITY_RECOVERY_TITLE}
                noticeDescription={UNRESOLVED_IDENTITY_RECOVERY_COPY}
                showTechnicalIds={false}
                canRecover={Boolean(organizationId) && !blockPartyOnboarding}
                recoverPendingKey={recoverPendingKey}
                onRecoverGovernmentId={async (payload) => {
                  if (!organizationId) return;
                  const pendingKey = `${payload.eodRequestId}:${payload.email ?? ""}`;
                  setRecoverPendingKey(pendingKey);
                  try {
                    const apiBase = directorShareholderOrgApiBase(portal, organizationId);
                    const result = await apiClient.patch<{ success: true }>(
                      `${apiBase}/unresolved-identity`,
                      payload
                    );
                    if (!result.success) {
                      toast.error(result.error.message);
                      return;
                    }
                    await onPartyOnboardingSent?.();
                    toast.success("Government ID saved. This record can now be matched.");
                  } finally {
                    setRecoverPendingKey(null);
                  }
                }}
                people={unresolvedPeople.map((p) => ({
                  name: p.name,
                  role: formatPeopleRolesLine(p),
                  sharePercentage: p.sharePercentage,
                  eodRequestId: p.requestId,
                  email: p.email ?? null,
                  recoverRole: p.roles.includes("DIRECTOR")
                    ? "DIRECTOR"
                    : p.roles.includes("SHAREHOLDER")
                      ? "SHAREHOLDER"
                      : undefined,
                  onboardingStatus: p.onboarding?.status ?? null,
                  amlStatus: p.screening?.status ?? null,
                  kycId: p.onboarding?.id ?? null,
                }))}
              />
            ) : null}
          </>
        )}
      </div>

      <AlertDialog open={confirmRow != null} onOpenChange={(open) => !open && setConfirmRow(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Send onboarding link</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow ? `Save email and send onboarding link to ${confirmRow.name}.` : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={savePending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg"
              disabled={savePending || !confirmRow}
              onClick={(e) => {
                e.preventDefault();
                void commitSend();
              }}
            >
              {savePending ? "Saving…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
