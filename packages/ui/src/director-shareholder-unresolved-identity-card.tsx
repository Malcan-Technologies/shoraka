"use client";

import { ChevronDownIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import * as React from "react";
import {
  getFinalStatusLabel,
  getFinalStatusToken,
  normalizeRawStatus,
  toTitleCase,
  UNRESOLVED_IDENTITY_ADMIN_COPY,
  UNRESOLVED_IDENTITY_ADMIN_TITLE,
  type UnresolvedIdentityRecoverRole,
} from "@cashsouk/types";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { StatusBadge } from "./components/status-badge";
import { cn } from "./lib/utils";

export type UnresolvedIdentityPersonInput = {
  name?: string | null;
  role?: string | null;
  sharePercentage?: number | null;
  eodRequestId?: string | null;
  email?: string | null;
  recoverRole?: UnresolvedIdentityRecoverRole;
  onboardingStatus?: string | null;
  kycId?: string | null;
  amlStatus?: string | null;
};

export type UnresolvedIdentityRecoverPayload = {
  eodRequestId: string;
  email?: string | null;
  role: UnresolvedIdentityRecoverRole;
  governmentId: string;
};

export interface DirectorShareholderUnresolvedIdentityCardProps extends UnresolvedIdentityPersonInput {
  className?: string;
  canRecover?: boolean;
  recoverPending?: boolean;
  showTechnicalIds?: boolean;
  onRecoverGovernmentId?: (payload: UnresolvedIdentityRecoverPayload) => Promise<void> | void;
}

function formatOnboardingStatusLabel(status: string | null | undefined): string {
  const normalized = normalizeRawStatus(status);
  if (!normalized) return "—";
  return toTitleCase(normalized.replace(/_/g, " "));
}

function formatOptionalStatusLabel(status: string | null | undefined): string | null {
  const normalized = normalizeRawStatus(status);
  if (!normalized) return null;
  return toTitleCase(normalized.replace(/_/g, " "));
}

/**
 * Compact card for one unresolved director/shareholder source record.
 * Technical RegTank ids stay under View details. Never merge rows by name.
 */
export function DirectorShareholderUnresolvedIdentityCard({
  name,
  role,
  sharePercentage,
  eodRequestId,
  email,
  recoverRole,
  onboardingStatus,
  kycId,
  amlStatus,
  className,
  canRecover = false,
  recoverPending = false,
  showTechnicalIds = true,
  onRecoverGovernmentId,
}: DirectorShareholderUnresolvedIdentityCardProps) {
  const displayName = name?.trim() || "—";
  const roleLine = role?.trim() || "—";
  const shareLabel =
    typeof sharePercentage === "number" && Number.isFinite(sharePercentage)
      ? `${sharePercentage}%`
      : null;
  const statusLabel = formatOnboardingStatusLabel(onboardingStatus);
  const statusTone = getFinalStatusLabel(
    { onboarding: { status: onboardingStatus }, screening: null },
    { displayMode: "kyc_only" }
  ).tone;
  const amlLabel = formatOptionalStatusLabel(amlStatus);
  const eod = eodRequestId?.trim() || null;
  const kyc = kycId?.trim() || null;
  const [governmentId, setGovernmentId] = React.useState("");
  const showRecover = Boolean(canRecover && onRecoverGovernmentId && recoverRole && eod);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm",
        className
      )}
      data-testid="unresolved-identity-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate font-medium text-foreground">{displayName}</p>
          <p className="text-xs text-muted-foreground">
            {roleLine}
            {shareLabel && !roleLine.toLowerCase().includes(shareLabel.toLowerCase())
              ? ` · ${shareLabel}`
              : null}
          </p>
          <p className="text-meta font-medium text-amber-800 dark:text-amber-200">
            Identity details incomplete
          </p>
        </div>
        <StatusBadge
          label={statusLabel}
          status={getFinalStatusToken(statusTone)}
          size="sm"
          className="shrink-0"
        />
      </div>

      <details className="mt-2 group">
        <summary
          className={cn(
            "flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground",
            "hover:text-foreground [&::-webkit-details-marker]:hidden"
          )}
        >
          <ChevronDownIcon
            className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
          View details
        </summary>
        <dl
          className="mt-2 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground"
          data-testid="unresolved-identity-details"
        >
          {showTechnicalIds && eod ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>RegTank record ID</dt>
              <dd className="font-mono text-foreground break-all">{eod}</dd>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-2">
            <dt>Missing information</dt>
            <dd className="text-foreground">Government ID</dd>
          </div>
          {showTechnicalIds && kyc ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>KYC ID</dt>
              <dd className="font-mono text-foreground break-all">{kyc}</dd>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-2">
            <dt>Onboarding status</dt>
            <dd className="text-foreground">{statusLabel}</dd>
          </div>
          {amlLabel ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>AML status</dt>
              <dd className="text-foreground">{amlLabel}</dd>
            </div>
          ) : null}
        </dl>
      </details>

      {showRecover ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <label
            className="block text-meta font-medium text-foreground"
            htmlFor={`gov-id-${eod}-${email ?? ""}`}
          >
            Government ID
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`gov-id-${eod}-${email ?? ""}`}
              value={governmentId}
              onChange={(event) => setGovernmentId(event.target.value)}
              placeholder="MyKad / government ID"
              disabled={recoverPending}
              className="h-10"
            />
            <Button
              type="button"
              className="h-10 shrink-0"
              disabled={recoverPending || governmentId.trim().length < 6}
              onClick={() => {
                if (!recoverRole || !eod) return;
                void onRecoverGovernmentId?.({
                  eodRequestId: eod,
                  email: email?.trim() || null,
                  role: recoverRole,
                  governmentId: governmentId.trim(),
                });
              }}
            >
              {recoverPending ? "Saving…" : "Save ID"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface DirectorShareholderUnresolvedIdentitySectionProps {
  people: UnresolvedIdentityPersonInput[];
  className?: string;
  isRefreshing?: boolean;
  noticeTitle?: string;
  noticeDescription?: string;
  noticeAction?: React.ReactNode;
  canRecover?: boolean;
  showTechnicalIds?: boolean;
  recoverPendingKey?: string | null;
  onRecoverGovernmentId?: (payload: UnresolvedIdentityRecoverPayload) => Promise<void> | void;
}

/**
 * Section-level notice + one compact card per unresolved source record.
 * Verified people should be rendered by the parent before this section.
 */
export function DirectorShareholderUnresolvedIdentitySection({
  people,
  className,
  isRefreshing = false,
  noticeTitle,
  noticeDescription,
  noticeAction,
  canRecover = false,
  showTechnicalIds = true,
  recoverPendingKey = null,
  onRecoverGovernmentId,
}: DirectorShareholderUnresolvedIdentitySectionProps) {
  if (!people.length) return null;

  return (
    <div
      className={cn("space-y-3", isRefreshing && "opacity-70", className)}
      aria-busy={isRefreshing || undefined}
      data-testid="unresolved-identity-section"
    >
      <div
        role="status"
        className="flex gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
        data-testid="unresolved-identity-section-notice"
      >
        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-snug">
            {noticeTitle ?? UNRESOLVED_IDENTITY_ADMIN_TITLE}
          </p>
          <p className="text-xs leading-relaxed text-amber-900/85 dark:text-amber-100/85">
            {noticeDescription ?? UNRESOLVED_IDENTITY_ADMIN_COPY}
          </p>
          {noticeAction ? <div className="pt-1">{noticeAction}</div> : null}
        </div>
      </div>

      <div className="space-y-2">
        {people.map((person, index) => (
          <DirectorShareholderUnresolvedIdentityCard
            key={`unresolved-${String(person.eodRequestId ?? "")}-${String(person.role ?? "")}-${index}`}
            {...person}
            canRecover={canRecover}
            showTechnicalIds={showTechnicalIds}
            recoverPending={
              recoverPendingKey != null &&
              recoverPendingKey ===
                `${String(person.eodRequestId ?? "")}:${String(person.email ?? "")}`
            }
            onRecoverGovernmentId={onRecoverGovernmentId}
          />
        ))}
      </div>
    </div>
  );
}
