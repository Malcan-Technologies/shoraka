"use client";

import * as React from "react";
import { ComputerDesktopIcon, UserIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@cashsouk/ui";
import {
  formatAdminTimelineValue,
  type AdminTimelineDetail,
} from "@/components/admin-timeline-format";
import {
  ADMIN_TIMELINE_ORIGINATOR_CLASS,
  ADMIN_TIMELINE_ORIGINATOR_LABEL,
  displayAdminTimelineActorName,
  resolveAdminTimelineOriginator,
  type AdminTimelineOriginator,
} from "@/components/admin-timeline-originator";
import { cn } from "@/lib/utils";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";

export type { AdminTimelineDetail };

export function AdminTimelineOriginatorMark({
  originator,
  size = "md",
}: {
  originator: AdminTimelineOriginator;
  size?: "sm" | "md";
}) {
  const Icon = originator === "system" ? ComputerDesktopIcon : UserIcon;
  return (
    <span
      role="img"
      aria-label={ADMIN_TIMELINE_ORIGINATOR_LABEL[originator]}
      className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full border-2 border-card",
        size === "sm" ? "h-6 w-6" : "h-8 w-8",
        ADMIN_TIMELINE_ORIGINATOR_CLASS[originator]
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
    </span>
  );
}

export type AdminTimelineBylineChip = {
  label: string;
  name: string;
};

export function AdminTimelineBylineChipRow({ label, name }: AdminTimelineBylineChip) {
  return (
    <p className="text-meta text-muted-foreground">
      {label} {name}
    </p>
  );
}

export function AdminTimelineDetailCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-2 rounded-lg border border-border/70 bg-muted/15 px-3 py-2", className)}>
      {children}
    </div>
  );
}

export function AdminVerticalTimelineSkeleton() {
  return (
    <div className="space-y-7">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminVerticalTimeline({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div>
      <div className="relative">
        <div className="absolute bottom-3 left-4 top-3 w-px bg-border" />
        <div className="space-y-7">{children}</div>
      </div>
      {footer}
    </div>
  );
}

export function AdminVerticalTimelineItem({
  title,
  description,
  descriptionClassName,
  createdAt,
  timestampActions,
  actorLabel,
  portal,
  bylineChips,
  compactDetails,
  prose,
  footer,
  onViewDetails,
}: {
  title: string;
  description?: string | null;
  descriptionClassName?: string;
  createdAt: Date | string;
  timestampActions?: React.ReactNode;
  actorLabel?: string | null;
  portal?: string | null;
  bylineChips?: AdminTimelineBylineChip[];
  compactDetails?: AdminTimelineDetail[];
  prose?: AdminTimelineDetail[];
  footer?: React.ReactNode;
  onViewDetails?: () => void;
}) {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  const originator = resolveAdminTimelineOriginator({ actorLabel, portal });
  const displayName = displayAdminTimelineActorName(actorLabel);
  const visibleChips = (bylineChips ?? []).filter((chip) => {
    const name = chip.name.trim().toLowerCase();
    return name && name !== (displayName ?? "").toLowerCase();
  });
  const compactRows = compactDetails ?? [];
  const proseRows = prose ?? [];
  const timestamp = formatAuditDateTime(created);

  return (
    <div className="relative flex gap-3">
      <AdminTimelineOriginatorMark originator={originator} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-ui font-medium leading-snug">{title}</p>
          <time
            className="shrink-0 text-meta tabular-nums text-muted-foreground"
            dateTime={created.toISOString()}
            title={timestamp}
          >
            {timestamp}
          </time>
        </div>

        {displayName ? <p className="mt-0.5 text-meta text-muted-foreground">{displayName}</p> : null}

        {description ? (
          <p className={cn("mt-1 text-ui text-muted-foreground", descriptionClassName)}>
            {description}
          </p>
        ) : null}

        {visibleChips.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {visibleChips.map((chip) => (
              <AdminTimelineBylineChipRow
                key={`${chip.label}-${chip.name}`}
                label={chip.label}
                name={chip.name}
              />
            ))}
          </div>
        ) : null}

        {timestampActions || onViewDetails ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui text-muted-foreground">
            {timestampActions}
            {onViewDetails ? (
              <button
                type="button"
                onClick={onViewDetails}
                className="hover:text-foreground hover:underline"
              >
                View details
              </button>
            ) : null}
          </div>
        ) : null}

        {compactRows.length > 0 ? (
          <dl className="mt-2 space-y-1">
            {compactRows.map((detail, index) => (
              <div
                key={detail.key ?? `${detail.label}-${index}`}
                className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-3 text-ui"
              >
                <dt className="text-muted-foreground">{detail.label}</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {formatAdminTimelineValue(detail.value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {proseRows.length > 0 ? (
          <div className="mt-2 space-y-2">
            {proseRows.map((detail, index) => (
              <div key={detail.key ?? `${detail.label}-${index}`}>
                <p className="text-meta text-muted-foreground">{detail.label}</p>
                <p className="mt-0.5 text-ui leading-relaxed text-foreground">
                  {formatAdminTimelineValue(detail.value)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {footer}
      </div>
    </div>
  );
}
