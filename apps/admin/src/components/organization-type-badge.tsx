import { StatusBadge } from "@cashsouk/ui";
import { getOrganizationTypePresentation } from "@/lib/organization-status";

export function OrganizationTypeBadge({
  type,
  className,
}: {
  type: "COMPANY" | "PERSONAL" | string;
  className?: string;
}) {
  const presentation = getOrganizationTypePresentation(type);
  return (
    <StatusBadge
      label={presentation.label}
      status={presentation.status}
      showDot={false}
      className={className}
    />
  );
}
