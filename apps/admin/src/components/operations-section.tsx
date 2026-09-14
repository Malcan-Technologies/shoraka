"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, Skeleton } from "@cashsouk/ui";
import { usePermissions } from "@/hooks/use-permissions";
import type { AdminPermission } from "@cashsouk/types";
import {
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
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";

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
  arrears: 0,
  defaulted: 0,
  cancelledOrFailedFunding: 0,
};

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
  lostTone: "rejected" | "neutral";
  actionLabel: string;
}

interface OperationsSectionProps {
  loading?: boolean;
  onboarding?: OnboardingOperationsMetrics;
  applications?: ApplicationDashboardMetrics;
  contracts?: ContractDashboardMetrics;
  notes?: NoteDashboardMetrics;
}

function StageRow({ stage, canNavigate }: { stage: StageMetric; canNavigate: boolean }) {
  const Icon = stage.icon;
  const known = stage.inFlight + stage.done + stage.lost;
  const segments: { key: BucketKey; label: string; n: number; tone: StatusBucketTone }[] = [
    { key: "inFlight", label: stage.inFlightLabel, n: stage.inFlight, tone: "in-progress" },
    { key: "done", label: stage.doneLabel, n: stage.done, tone: "success" },
    { key: "lost", label: stage.lostLabel, n: stage.lost, tone: stage.lostTone },
  ];
  const distressedAction = stage.key === "notes" && stage.actionRequired > 0;

  const inner = (
    <div className="grid grid-cols-1 gap-4 py-4 md:grid-cols-[minmax(11.5rem,1fr)_minmax(0,3fr)_10.5rem] md:items-center md:gap-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <div className="text-ui font-medium text-foreground">{stage.label}</div>
          <div className="text-meta text-muted-foreground">{stage.total} total</div>
        </div>
        {stage.actionRequired > 0 ? (
          <span
            className={cn(
              "ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-meta",
              distressedAction
                ? "bg-status-rejected-bg text-status-rejected-text"
                : "bg-status-action-bg text-status-action-text"
            )}
          >
            {stage.actionRequired} {stage.actionLabel}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        {known === 0 ? (
          <div className="h-3.5 w-full rounded-full border border-dashed border-border bg-muted/40" />
        ) : (
          <div
            className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Mix: ${segments.map((s) => `${s.label} ${s.n}`).join(", ")}`}
          >
            {segments.map((seg) => {
              if (seg.n === 0) return null;
              const pct = (seg.n / known) * 100;
              return (
                <div
                  key={seg.key}
                  className={STATUS_BUCKET_FILL[seg.tone]}
                  style={{ width: `${pct}%` }}
                  title={`${seg.label}: ${seg.n} (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted-foreground">
          {segments.map((seg) => (
            <span key={seg.key} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 shrink-0 rounded-[2px]", STATUS_BUCKET_FILL[seg.tone])} aria-hidden />
              {seg.label} {seg.n}
            </span>
          ))}
        </div>
      </div>

      <div className="text-left md:text-right">
        <div className="text-3xl font-bold tabular-nums tracking-tight leading-none text-foreground">
          {stage.inFlight}
        </div>
        <div className="mt-1 text-meta text-muted-foreground">in flight</div>
      </div>
    </div>
  );

  const className = cn(
    "block min-w-0 border-b border-border last:border-b-0",
    canNavigate && "rounded-lg transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  );

  if (canNavigate) {
    return (
      <Link href={stage.href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function PipelineSkeleton() {
  return (
    <section>
      <DashboardSectionHeader
        title="Lifecycle pipeline"
        subtitle="Onboarding → Applications → Facilities → Notes"
      />
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="space-y-4 px-6 py-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </section>
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
      lostLabel: "Rejected / expired",
      lostTone: "rejected",
      actionLabel: "to act",
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
      actionLabel: "to act",
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
      actionLabel: "to act",
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
      lostLabel: "Distressed / closed",
      lostTone: "rejected",
      actionLabel: "distressed",
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
    <section>
      <DashboardSectionHeader
        title="Lifecycle pipeline"
        subtitle="Onboarding → Applications → Facilities → Notes"
        action={
          <span
            className={cn(
              "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-ui",
              totalActionRequired > 0
                ? "bg-status-action-bg text-status-action-text"
                : "bg-status-neutral-bg text-status-neutral-text"
            )}
          >
            <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden />
            {totalActionRequired} action{totalActionRequired === 1 ? "" : "s"} required
          </span>
        }
      />
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="px-6 py-1 md:px-6">
          {stages.map((stage) => (
            <StageRow
              key={stage.key}
              stage={stage}
              canNavigate={can(stageNavPermissions[stage.key])}
            />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
