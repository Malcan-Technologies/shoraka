"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@cashsouk/ui";
import { usePermissions } from "@/hooks/use-permissions";
import type { AdminPermission } from "@cashsouk/types";
import {
  ArrowRightIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import type {
  ApplicationDashboardMetrics,
  ContractDashboardMetrics,
  NoteDashboardMetrics,
  OnboardingOperationsMetrics,
} from "@cashsouk/types";

const EMPTY_APPLICATION_METRICS: ApplicationDashboardMetrics = {
  total: 0,
  actionRequired: 0,
  draft: 0,
  contractOrAmendmentCycle: 0,
  approvedCompleted: 0,
  withdrawnRejectedOrArchived: 0,
};

const EMPTY_CONTRACT_METRICS: ContractDashboardMetrics = {
  total: 0,
  actionRequired: 0,
  draft: 0,
  offerSent: 0,
  approved: 0,
  rejectedOrWithdrawn: 0,
};

const EMPTY_NOTE_METRICS: NoteDashboardMetrics = {
  total: 0,
  draft: 0,
  live: 0,
  repaid: 0,
  distressed: 0,
  cancelledOrFailedFunding: 0,
};

/** Pipeline buckets mapped to status badge tokens (BRANDING.md §3 / packages/config status-badges). */
type StatusBucketTone = "in-progress" | "success" | "rejected" | "neutral";

const STATUS_BUCKET_FILL: Record<StatusBucketTone, string> = {
  "in-progress": "bg-status-in-progress-text",
  success: "bg-status-success-text",
  rejected: "bg-status-rejected-text",
  neutral: "bg-status-neutral-text",
};

type BucketKey = "inFlight" | "done" | "lost";

interface StageMetric {
  key: "onboarding" | "applications" | "contracts" | "notes";
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  total: number;
  inFlight: number;
  done: number;
  lost: number;
  actionRequired: number;
  inFlightLabel: string;
  doneLabel: string;
  lostLabel: string;
  /** Terminal/exit bucket tone — rejected for declines, neutral for closed/archived. */
  lostTone: "rejected" | "neutral";
}

interface OperationsSectionProps {
  loading?: boolean;
  onboarding?: OnboardingOperationsMetrics;
  applications?: ApplicationDashboardMetrics;
  contracts?: ContractDashboardMetrics;
  notes?: NoteDashboardMetrics;
}

function StageCard({ stage, canNavigate }: { stage: StageMetric; canNavigate: boolean }) {
  const Icon = stage.icon;
  const known = stage.inFlight + stage.done + stage.lost;
  const segments: { key: BucketKey; label: string; n: number; tone: StatusBucketTone }[] = [
    { key: "inFlight", label: stage.inFlightLabel, n: stage.inFlight, tone: "in-progress" },
    { key: "done", label: stage.doneLabel, n: stage.done, tone: "success" },
    { key: "lost", label: stage.lostLabel, n: stage.lost, tone: stage.lostTone },
  ];

  const baseClassName =
    "group flex h-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const navClassName = canNavigate
    ? `${baseClassName} hover:border-primary/40 hover:bg-muted/30`
    : `${baseClassName} cursor-default`;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{stage.label}</span>
        </div>
        {stage.actionRequired > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-action-bg px-2 py-0.5 text-[11px] font-normal text-status-action-text">
            <ExclamationTriangleIcon className="h-3 w-3" aria-hidden />
            {stage.actionRequired}
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">All clear</span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {stage.inFlight}
        </span>
        <span className="text-xs text-muted-foreground">
          in flight · {stage.total} total
        </span>
      </div>

      {known === 0 ? (
        <div className="h-1.5 w-full rounded-full border border-dashed border-border bg-muted/40" />
      ) : (
        <div
          className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-border p-px"
          role="img"
          aria-label={`Mix: ${segments.map((s) => `${s.label} ${s.n}`).join(", ")}`}
        >
          {segments.map((seg) => {
            if (seg.n === 0) return null;
            const pct = (seg.n / known) * 100;
            return (
              <div
                key={seg.key}
                className={cn(
                  "min-w-1 rounded-sm first:rounded-l-[calc(var(--radius)-2px)] last:rounded-r-[calc(var(--radius)-2px)]",
                  STATUS_BUCKET_FILL[seg.tone]
                )}
                style={{ width: `${pct}%` }}
                title={`${seg.label}: ${seg.n} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
      )}

      <dl className="space-y-1.5 text-[11px]">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center justify-between gap-3">
            <dt className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span
                className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_BUCKET_FILL[seg.tone])}
                aria-hidden
              />
              <span className="truncate" title={seg.label}>
                {seg.label}
              </span>
            </dt>
            <dd className="shrink-0 font-semibold tabular-nums text-foreground">{seg.n}</dd>
          </div>
        ))}
      </dl>
    </>
  );

  if (canNavigate) {
    return (
      <Link href={stage.href} className={navClassName}>
        {inner}
      </Link>
    );
  }

  return <div className={navClassName}>{inner}</div>;
}

function PipelineSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function OperationsSection({
  loading = false,
  onboarding,
  applications,
  contracts,
  notes,
}: OperationsSectionProps) {
  const { can } = usePermissions();

  if (loading) return <PipelineSkeleton />;

  const ob = onboarding;
  const inProgress = ob?.inProgress ?? 0;
  const pending = ob?.pending ?? 0;
  const approved = ob?.approved ?? 0;
  const rejected = ob?.rejected ?? 0;
  const expired = ob?.expired ?? 0;
  const onboardingTotal = inProgress + pending + approved + rejected + expired;

  const apps = applications ?? EMPTY_APPLICATION_METRICS;
  const cts = contracts ?? EMPTY_CONTRACT_METRICS;
  const nts = notes ?? EMPTY_NOTE_METRICS;

  const stages: StageMetric[] = [
    {
      key: "onboarding",
      label: "Onboarding",
      href: "/onboarding-approval",
      icon: DocumentCheckIcon,
      total: onboardingTotal,
      inFlight: inProgress + pending,
      done: approved,
      lost: rejected + expired,
      actionRequired: pending,
      inFlightLabel: "In progress",
      doneLabel: "Approved",
      lostLabel: "Rejected/expired",
      lostTone: "rejected",
    },
    {
      key: "applications",
      label: "Applications",
      href: "/applications",
      icon: ClipboardDocumentListIcon,
      total: apps.total,
      inFlight: apps.draft + apps.actionRequired + apps.contractOrAmendmentCycle,
      done: apps.approvedCompleted,
      lost: apps.withdrawnRejectedOrArchived,
      actionRequired: apps.actionRequired,
      inFlightLabel: "Active",
      doneLabel: "Approved",
      lostLabel: "Closed",
      lostTone: "neutral",
    },
    {
      key: "contracts",
      label: "Facilities",
      href: "/contracts",
      icon: DocumentTextIcon,
      total: cts.total,
      inFlight: cts.draft + cts.actionRequired + cts.offerSent,
      done: cts.approved,
      lost: cts.rejectedOrWithdrawn,
      actionRequired: cts.actionRequired,
      inFlightLabel: "Active",
      doneLabel: "Approved",
      lostLabel: "Closed",
      lostTone: "rejected",
    },
    {
      key: "notes",
      label: "Notes",
      href: "/notes",
      icon: BanknotesIcon,
      total: nts.total,
      inFlight: nts.draft + nts.live,
      done: nts.repaid,
      lost: nts.distressed + nts.cancelledOrFailedFunding,
      actionRequired: nts.distressed,
      inFlightLabel: "Live",
      doneLabel: "Repaid",
      lostLabel: "Distressed/closed",
      lostTone: "rejected",
    },
  ];

  const stageNavPermissions: Record<StageMetric["key"], AdminPermission> = {
    onboarding: "onboarding.view",
    applications: "applications.view",
    contracts: "contracts.view",
    notes: "notes.view",
  };

  const totalActionRequired = stages.reduce((sum, s) => sum + s.actionRequired, 0);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base font-medium">Lifecycle pipeline</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="sm:hidden">Pipeline stages from onboarding to notes</span>
              <span className="hidden sm:inline">
                Onboarding → Applications → Facilities → Notes
              </span>
            </p>
          </div>
          <span
            className={cn(
              "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-normal",
              totalActionRequired > 0
                ? "bg-status-action-bg text-status-action-text"
                : "bg-status-neutral-bg text-status-neutral-text"
            )}
          >
            <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden />
            {totalActionRequired} action{totalActionRequired === 1 ? "" : "s"} required
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] 2xl:items-stretch">
          {stages.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <StageCard
                stage={stage}
                canNavigate={can(stageNavPermissions[stage.key])}
              />
              {i < stages.length - 1 ? (
                <div
                  className="hidden items-center justify-center text-muted-foreground 2xl:flex"
                  aria-hidden
                >
                  <ArrowRightIcon className="h-5 w-5" />
                </div>
              ) : null}
            </React.Fragment>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
