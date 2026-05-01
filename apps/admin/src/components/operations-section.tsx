"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@cashsouk/ui";
import {
  ArrowRightIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  DocumentCheckIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";
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

/** Stage palette aligned with BRANDING.md (earth brown, taupe, primary red, success, neutral) */
const stageBucketPalette = {
  inFlight: { light: "hsl(29.6 51% 28.8%)", dark: "hsl(29.6 42% 52%)" }, // earth brown
  done: { light: "hsl(152 36% 36%)", dark: "hsl(152 32% 48%)" }, // success green
  lost: { light: "hsl(215 16% 60%)", dark: "hsl(215 18% 38%)" }, // neutral
} as const;

type BucketKey = keyof typeof stageBucketPalette;

function bucketColor(key: BucketKey, isDark: boolean) {
  return isDark ? stageBucketPalette[key].dark : stageBucketPalette[key].light;
}

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
}

interface OperationsSectionProps {
  loading?: boolean;
  onboarding?: OnboardingOperationsMetrics;
  applications?: ApplicationDashboardMetrics;
  contracts?: ContractDashboardMetrics;
  notes?: NoteDashboardMetrics;
}

function StageCard({ stage, isDark }: { stage: StageMetric; isDark: boolean }) {
  const Icon = stage.icon;
  const known = stage.inFlight + stage.done + stage.lost;
  const segments: { key: BucketKey; label: string; n: number }[] = [
    { key: "inFlight", label: stage.inFlightLabel, n: stage.inFlight },
    { key: "done", label: stage.doneLabel, n: stage.done },
    { key: "lost", label: stage.lostLabel, n: stage.lost },
  ];

  return (
    <Link
      href={stage.href}
      className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          {stage.label}
        </div>
        {stage.actionRequired > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            <ExclamationTriangleIcon className="h-3 w-3" aria-hidden />
            {stage.actionRequired}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground">All clear</span>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
          {stage.inFlight}
        </span>
        <span className="text-xs text-muted-foreground">in flight · {stage.total} total</span>
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
                className="rounded-sm first:rounded-l-[calc(var(--radius)-2px)] last:rounded-r-[calc(var(--radius)-2px)]"
                style={{
                  width: `${pct}%`,
                  minWidth: "0.25rem",
                  backgroundColor: bucketColor(seg.key, isDark),
                }}
                title={`${seg.label}: ${seg.n} (${Math.round(pct)}%)`}
              />
            );
          })}
        </div>
      )}

      <dl className="grid grid-cols-3 gap-1 text-[11px]">
        {segments.map((seg) => (
          <div key={seg.key} className="flex flex-col">
            <dt className="flex items-center gap-1 text-muted-foreground">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: bucketColor(seg.key, isDark) }}
                aria-hidden
              />
              {seg.label}
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">{seg.n}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function PipelineSkeleton() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

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
    },
    {
      key: "contracts",
      label: "Contracts",
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
    },
  ];

  const totalActionRequired = stages.reduce((sum, s) => sum + s.actionRequired, 0);

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-medium">Lifecycle pipeline</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Onboarding → Applications → Contracts → Notes
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              totalActionRequired > 0
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            <ExclamationTriangleIcon className="h-3.5 w-3.5" aria-hidden />
            {totalActionRequired} action{totalActionRequired === 1 ? "" : "s"} required
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-stretch">
          {stages.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <StageCard stage={stage} isDark={isDark} />
              {i < stages.length - 1 ? (
                <div
                  className="hidden items-center justify-center text-muted-foreground xl:flex"
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
