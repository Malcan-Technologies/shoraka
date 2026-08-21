import {
  onboardingStatusLabel,
  onboardingStatusToToken,
} from "@cashsouk/config";
import { cn } from "../lib/utils";
import { StatusBadge, VerifiedBadge, type StatusBadgeProps } from "./status-badge";

export function OnboardingOrgStatusBadge({
  status,
  regtankStatus,
  size = "default",
  className,
}: {
  status: string;
  regtankStatus?: string | null;
  size?: StatusBadgeProps["size"];
  className?: string;
}) {
  const label = onboardingStatusLabel(status, regtankStatus);
  const chipClassName = cn("mt-1.5 justify-self-start", className);

  if (label === "Verified") {
    return <VerifiedBadge size={size} className={chipClassName} />;
  }

  return (
    <StatusBadge
      label={label}
      status={onboardingStatusToToken(status, regtankStatus)}
      size={size}
      className={chipClassName}
    />
  );
}
