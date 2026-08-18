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

export function OrganizationSwitcherCaption({
  type,
}: {
  type?: string | null;
}) {
  return (
    <span className="mt-0.5 truncate text-meta text-muted-foreground">
      {organizationTypeLabel(type ?? "")}
    </span>
  );
}
