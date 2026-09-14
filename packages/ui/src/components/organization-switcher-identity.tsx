import type { ComponentType, SVGProps } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import {
  onboardingActionIconClass,
  onboardingStatusLabel,
  onboardingStatusToToken,
  type UserPortalStatusToken,
} from "@cashsouk/config";
import { cn } from "../lib/utils";

export function organizationTypeLabel(type: string): string {
  return type.trim().toUpperCase() === "PERSONAL" ? "Personal" : "Company";
}

const SWITCHER_STATUS_ICON: Record<
  UserPortalStatusToken,
  ComponentType<SVGProps<SVGSVGElement>>
> = {
  success: CheckCircleIcon,
  action: ExclamationCircleIcon,
  submitted: ClockIcon,
  rejected: XCircleIcon,
  active: CheckCircleIcon,
  neutral: BuildingOffice2Icon,
};

export function OrganizationSwitcherAvatar({
  status,
  regtankStatus,
  size = "md",
  className,
}: {
  status: string;
  regtankStatus?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const token = onboardingStatusToToken(status, regtankStatus);
  const Icon = SWITCHER_STATUS_ICON[token];
  const iconClass = size === "sm" ? "size-3.5" : "size-4";
  const label = onboardingStatusLabel(status, regtankStatus);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center",
        size === "sm" ? "size-7 rounded-md" : "size-8 rounded-lg",
        onboardingActionIconClass(status, regtankStatus),
        className
      )}
      aria-label={label}
    >
      <Icon className={iconClass} aria-hidden />
    </div>
  );
}

function organizationSwitcherCaptionParts({
  type,
  displayReference,
  status,
  regtankStatus,
}: {
  type?: string | null;
  displayReference?: string | null;
  status?: string;
  regtankStatus?: string | null;
}): { statusLabel: string | null; displayReference: string | null; fallback: string | null } {
  const statusLabel = status ? onboardingStatusLabel(status, regtankStatus) : null;
  const reference = displayReference?.trim() || null;
  return {
    statusLabel,
    displayReference: reference,
    fallback: statusLabel || reference ? null : organizationTypeLabel(type ?? ""),
  };
}

export function organizationSwitcherSecondaryText({
  type,
  displayReference,
  status,
  regtankStatus,
}: {
  type?: string | null;
  displayReference?: string | null;
  status?: string;
  regtankStatus?: string | null;
}): string {
  const parts = organizationSwitcherCaptionParts({
    type,
    displayReference,
    status,
    regtankStatus,
  });
  const line = [parts.statusLabel, parts.displayReference].filter(Boolean);
  return line.length > 0 ? line.join(" · ") : (parts.fallback ?? "");
}

export function OrganizationSwitcherCaption({
  type,
  displayReference,
  status,
  regtankStatus,
}: {
  type?: string | null;
  displayReference?: string | null;
  status?: string;
  regtankStatus?: string | null;
}) {
  const parts = organizationSwitcherCaptionParts({
    type,
    displayReference,
    status,
    regtankStatus,
  });
  const label = organizationSwitcherSecondaryText({
    type,
    displayReference,
    status,
    regtankStatus,
  });

  return (
    <span
      className="mt-0.5 flex min-w-0 items-baseline gap-1 text-meta leading-tight text-muted-foreground"
      title={label}
    >
      {parts.statusLabel ? <span className="shrink-0">{parts.statusLabel}</span> : null}
      {parts.statusLabel && parts.displayReference ? (
        <span className="shrink-0 text-muted-foreground/40" aria-hidden>
          ·
        </span>
      ) : null}
      {parts.displayReference ? (
        <span className="min-w-0 truncate tabular-nums tracking-wide text-muted-foreground/70">
          {parts.displayReference}
        </span>
      ) : null}
      {parts.fallback ? <span className="truncate">{parts.fallback}</span> : null}
    </span>
  );
}
