import { StatusBadge } from "@cashsouk/ui";
import { toTitleCase } from "@cashsouk/types";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { getReviewStatusPresentation } from "./status-presentation";

interface ApplicationStatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function ApplicationStatusBadge({ status, size = "md", label }: ApplicationStatusBadgeProps) {
  const presentation = getReviewStatusPresentation(status);
  const displayLabel = toTitleCase(label ?? presentation.label);

  return (
    <StatusBadge
      label={displayLabel || presentation.label}
      status={getAdminStatusToken(status)}
      size={size === "sm" ? "sm" : "default"}
    />
  );
}
