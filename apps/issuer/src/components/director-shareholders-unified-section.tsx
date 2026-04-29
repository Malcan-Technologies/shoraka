"use client";

import * as React from "react";
import {
  UserGroupIcon,
  UserIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  getCtosPartySupplementFlatRead,
  getCtosPartySupplementRequestId,
  getDirectorKycPartyRecord,
  getDisplayStatus,
  getDisplayRoleLabel,
  isCtosIndividualKycEligibleRow,
  isCtosPartySupplementApprovalLocked,
  normalizeDirectorShareholderIdKey,
  normalizeRawStatus,
  regtankDisplayStatusBadgeClass,
  type ApplicationPersonRow,
  type DirectorShareholderDisplayRow,
} from "@cashsouk/types";
import {
  type CorporateEntitiesShape,
  getSupplementOnboardingJson,
  getSupplementPipelineStatus,
  getSupplementRequestId,
  isPartyTypeA,
  isRegTankSubmitReadyStatus,
} from "@/lib/director-shareholder-onboarding-ui";
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
  /** When set with `organizationId`, party email / send onboarding are allowed only if `COMPLETED`. */
  organizationOnboardingStatus?: string | null;
  people: ApplicationPersonRow[];
  ctosPartySupplements?: { partyKey: string; onboardingJson?: unknown }[] | null;
  /** When set, TYPE A/B rules: legacy KYC list + corporate entities vs new CTOS parties; TYPE B uses supplement-only pipeline status. */
  partySource?: {
    directorKycStatus: unknown;
    corporateEntities: CorporateEntitiesShape | null;
  };
  className?: string;
  /** Marks rows needing email/KYC with `data-action-required` (no colored row chrome). */
  highlightActionRequiredRows?: boolean;
  /** After navigation from company details; focuses first visible empty email field. */
  autoFocusFirstEmptyEmail?: boolean;
}

type AugmentedRow = DirectorShareholderDisplayRow & { __person: ApplicationPersonRow };

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
  const display = normalizeRawStatus(row.status);
  return { display, badgeClass: regtankDisplayStatusBadgeClass(display) };
}

function renderStatusBadge(raw: string) {
  const label = normalizeRawStatus(raw);
  if (!label) return null;
  const cls = regtankDisplayStatusBadgeClass(label);

  if (label === "APPROVED") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <CheckCircleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (label === "REJECTED") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <XCircleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {label}
      </Badge>
    );
  }

  if (label === "STATUS_UNAVAILABLE") {
    return (
      <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
        <ExclamationTriangleIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("border-transparent text-[11px] font-normal", cls)}>
      <ClockIcon className="h-3 w-3 mr-1 shrink-0" aria-hidden />
      {label}
    </Badge>
  );
}

function partyKeyRawForRow(row: DirectorShareholderDisplayRow): string {
  return (
    row.registrationNumber?.trim() ||
    row.idNumber?.trim() ||
    row.enquiryId?.trim() ||
    ""
  );
}

function rowKycApproved(row: DirectorShareholderDisplayRow): boolean {
  return normalizeRawStatus(row.status) === "APPROVED";
}

function rowNeedsProfileAction(row: DirectorShareholderDisplayRow, emailDisplay: string): boolean {
  if (rowKycApproved(row)) return false;
  return !emailDisplay.trim() || !normalizeRawStatus(row.status);
}

function onboardingApprovalLockActive(onboardingJson: unknown): boolean {
  return isCtosPartySupplementApprovalLocked(onboardingJson);
}

function isRowComplete(row: DirectorShareholderDisplayRow, persistedEmail: string): boolean {
  return Boolean(persistedEmail?.trim()) && Boolean(normalizeRawStatus(row.status));
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
    Boolean(normalizeRawStatus(row.status))
  );
}

function personToDisplayRow(
  p: ApplicationPersonRow,
  onboardingByPartyKey: Map<string, Record<string, unknown>>
): DirectorShareholderDisplayRow {
  const pk = normalizeDirectorShareholderIdKey(p.matchKey);
  const sup = pk ? onboardingByPartyKey.get(pk) ?? {} : {};
  const flat = getCtosPartySupplementFlatRead(sup);
  const requestId = flat.requestId;
  const regtankStatus = flat.regtankStatus;
  const kycBlock = flat.kycBlock;
  const kycRawStatus = kycBlock ? String(kycBlock.rawStatus ?? "").trim() || null : null;
  const status = getDisplayStatus({
    screening: p.screening,
    directorKycStatus: kycRawStatus,
    onboarding: { status: regtankStatus || requestId },
  });
  const rolesU = (p.roles ?? []).map((r) => r.toUpperCase());
  const isDirector = rolesU.includes("DIRECTOR");
  const isShareholder = rolesU.includes("SHAREHOLDER");
  const sharePct = p.sharePercentage;
  const ownershipDisplay =
    sharePct != null && Number.isFinite(sharePct) ? `${sharePct}% ownership` : null;
  const email = String(sup.email ?? sup.contactEmail ?? "").trim();
  const draftEligible =
    p.entityType === "INDIVIDUAL" &&
    (isDirector || (isShareholder && (sharePct ?? 0) >= 5));
  return {
    id: p.matchKey,
    name: p.name ?? "",
    role: formatPeopleRolesLine(p),
    type: p.entityType === "CORPORATE" ? "COMPANY" : "INDIVIDUAL",
    idNumber: p.entityType === "INDIVIDUAL" ? p.matchKey : null,
    registrationNumber: p.entityType === "CORPORATE" ? p.matchKey : null,
    ownershipDisplay,
    email,
    status,
    canEnterEmail: true,
    canSendOnboarding: true,
    enquiryId: null,
    subjectKind: p.entityType === "CORPORATE" ? "CORPORATE" : "INDIVIDUAL",
    ctosIndividualKycEligible: draftEligible,
    isDirector,
    isShareholder,
    sharePercentage: sharePct,
  };
}

export function DirectorShareholdersUnifiedSection({
  organizationId,
  organizationOnboardingStatus = null,
  people,
  ctosPartySupplements,
  partySource,
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
  const [confirmRow, setConfirmRow] = React.useState<AugmentedRow | null>(null);
  const [savePending, setSavePending] = React.useState(false);

  const blockPartyOnboarding =
    Boolean(organizationId) && organizationOnboardingStatus !== "COMPLETED";

  const onboardingByPartyKey = React.useMemo(() => {
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

  const rows = React.useMemo(
    () =>
      filterVisiblePeopleRows(people).map(
        (p) =>
          ({
            ...personToDisplayRow(p, onboardingByPartyKey),
            __person: p,
          }) as AugmentedRow
      ),
    [people, onboardingByPartyKey, sentRowIds]
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

  const commitSend = async () => {
    if (!confirmRow) return;
    if (blockPartyOnboarding) {
      setConfirmRow(null);
      return;
    }
    if (!isCtosIndividualKycEligibleRow(confirmRow)) {
      toast.error("Individual onboarding is not required for this party.");
      setConfirmRow(null);
      return;
    }
    if (
      partySource &&
      isPartyTypeA(confirmRow.__person, partySource.directorKycStatus, partySource.corporateEntities)
    ) {
      toast.error("This party already has a company KYC/KYB record.");
      setConfirmRow(null);
      return;
    }
    if (!partySource && rowKycApproved(confirmRow)) {
      toast.error("This person already completed KYC on the company record.");
      setConfirmRow(null);
      return;
    }
    const email = displayEmail(confirmRow).trim();
    const rawKey = partyKeyRawForRow(confirmRow);
    const partyKeyNorm = normalizeDirectorShareholderIdKey(rawKey);
    const latestOnboarding = partyKeyNorm ? onboardingByPartyKey.get(partyKeyNorm) : undefined;
    const hadRequestId = getCtosPartySupplementRequestId(latestOnboarding ?? {}).length > 0;
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

  const renderPersonRow = (row: AugmentedRow) => {
    const person = row.__person;
    const ic = row.idNumber?.trim();
    const em = displayEmail(row);
    const persistedEmail = row.email;
    const linkSent = onboardingLinkSentForRow(row);
    const partyKeyNorm = normalizeDirectorShareholderIdKey(partyKeyRawForRow(row));
    const latestOnboarding = partyKeyNorm ? onboardingByPartyKey.get(partyKeyNorm) : undefined;
    const latestFlat = getCtosPartySupplementFlatRead(latestOnboarding ?? {});
    const latestRequestId = latestFlat.requestId;
    const latestVerifyLink = latestFlat.verifyLink;
    const supJson =
      partySource && ctosPartySupplements
        ? getSupplementOnboardingJson(person.matchKey, ctosPartySupplements)
        : (latestOnboarding as Record<string, unknown>) ?? {};
    const pipelineStatus = partySource ? getSupplementPipelineStatus(supJson) : "";
    const supplementLocked = onboardingApprovalLockActive(latestOnboarding);
    const typeA =
      !!partySource && isPartyTypeA(person, partySource.directorKycStatus, partySource.corporateEntities);
    const legacyApprovalLocked = rowKycApproved(row) || onboardingApprovalLockActive(latestOnboarding);
    const approvalLocked = partySource ? supplementLocked : legacyApprovalLocked;
    const kycUi = ctosKycStatusUiFromRow(row);
    const supplementReady = partySource
      ? Boolean(getSupplementRequestId(supJson)) && isRegTankSubmitReadyStatus(pipelineStatus)
      : false;
    const completedUx = partySource
      ? supplementReady || (sentRowIds.has(row.id) && Boolean(em.trim()))
      : isRowCompleteForUi(row, persistedEmail, em, sentRowIds);
    const kycEligible = isCtosIndividualKycEligibleRow(row);
    const showEmailControls = partySource
      ? !typeA && kycEligible && !supplementLocked && !blockPartyOnboarding
      : kycEligible && !approvalLocked && !blockPartyOnboarding;
    const needsAction = partySource
      ? !typeA && kycEligible && !supplementReady && !blockPartyOnboarding
      : kycEligible && rowNeedsProfileAction(row, em) && !linkSent;
    const showActionCue =
      highlightActionRequiredRows && kycEligible && !completedUx && !linkSent && needsAction;
    const rowSentVisual = linkSent && "border-border bg-muted/50 ring-1 ring-border/80";
    const rowCompleteVisual =
      !linkSent && completedUx && "border-primary/25 bg-primary/5 ring-1 ring-primary/20";

    const legacyKycRec =
      partySource && typeA ? getDirectorKycPartyRecord(person.matchKey, partySource.directorKycStatus) : null;
    const legacyKycLabel = normalizeRawStatus(legacyKycRec?.kycStatus);

    return (
      <div
        key={row.id}
        data-action-required={showActionCue ? "true" : undefined}
        className={cn(
          "flex flex-col gap-3 p-4 rounded-lg border border-border bg-muted/30 sm:flex-row sm:items-start sm:justify-between",
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
          {!typeA ? <p className="text-xs text-muted-foreground mt-1">{em.trim() ? em : ""}</p> : null}
          <p className="text-xs text-muted-foreground mt-1">{personRoleDisplayLabel(row)}</p>
          <div className="mt-1 flex flex-wrap flex-col gap-1">
            {partySource && typeA ? (
              <div className="flex flex-wrap items-center gap-2">
                {renderStatusBadge(legacyKycLabel)}
              </div>
            ) : partySource && !typeA ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                {renderStatusBadge(pipelineStatus)}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusBadge(kycUi.display)}
                </div>
                {row.amlStatus?.trim() ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">AML</span>
                    {renderStatusBadge(row.amlStatus)}
                  </div>
                ) : null}
              </>
            )}
          </div>
          {latestRequestId && !typeA ? (
            <p className="text-xs text-muted-foreground mt-1">Latest request ID: {latestRequestId}</p>
          ) : null}
          {showEmailControls && latestRequestId ? (
            <p className="text-xs text-muted-foreground mt-2">
              This will restart onboarding and discard previous progress.
            </p>
          ) : null}
        </div>
        {!typeA && kycEligible && blockPartyOnboarding ? null : !typeA && approvalLocked && !showEmailControls ? (
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">KYC approved</span>
          </div>
        ) : !typeA && showEmailControls ? (
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
              variant="default"
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
        ) : !typeA && completedUx ? (
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">Completed</span>
          </div>
        ) : null}
      </div>
    );
  };

  const renderCorpRow = (row: AugmentedRow) => {
    const person = row.__person;
    const persistedEmail = row.email;
    const linkSent = onboardingLinkSentForRow(row);
    const partyKeyNorm = normalizeDirectorShareholderIdKey(partyKeyRawForRow(row));
    const latestOnboarding = partyKeyNorm ? onboardingByPartyKey.get(partyKeyNorm) : undefined;
    const supJson =
      partySource && ctosPartySupplements
        ? getSupplementOnboardingJson(person.matchKey, ctosPartySupplements)
        : (latestOnboarding as Record<string, unknown>) ?? {};
    const pipelineStatus = partySource ? getSupplementPipelineStatus(supJson) : "";
    const typeA =
      !!partySource && isPartyTypeA(person, partySource.directorKycStatus, partySource.corporateEntities);
    const kycUi = ctosKycStatusUiFromRow(row);
    const supplementReady = partySource
      ? Boolean(getSupplementRequestId(supJson)) && isRegTankSubmitReadyStatus(pipelineStatus)
      : false;
    const completedUx = partySource
      ? supplementReady
      : isRowCompleteForUi(row, persistedEmail, persistedEmail, sentRowIds);
    const rowSentVisual = linkSent && "border-border bg-muted/50 ring-1 ring-border/80";
    const rowCompleteVisual = !linkSent && completedUx && "border-primary/25 bg-primary/5 ring-1 ring-primary/20";
    return (
      <div
        key={row.id}
        className={cn(
          "flex flex-col gap-3 p-4 rounded-lg border border-border bg-muted/30 sm:flex-row sm:items-center sm:justify-between",
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
            {row.role?.trim() ? row.role : "Corporate Shareholder"}
          </p>
          <div className="mt-1 flex flex-wrap flex-col gap-1">
            {partySource && typeA ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">KYB</span>
                {renderStatusBadge(pipelineStatus)}
              </div>
            ) : partySource && !typeA ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Status</span>
                {renderStatusBadge(pipelineStatus)}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {renderStatusBadge(kycUi.display)}
                </div>
                {row.amlStatus?.trim() ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">AML</span>
                    {renderStatusBadge(row.amlStatus)}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
        {linkSent ? null : completedUx ? (
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="text-sm font-medium text-foreground">Completed</span>
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
              disabled={
                savePending ||
                !confirmRow ||
                !displayEmail(confirmRow).trim() ||
                blockPartyOnboarding
              }
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
