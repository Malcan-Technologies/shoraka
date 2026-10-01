/**
 * SECTION: Workflow requirement badges for supporting document rows
 * WHY: Badges scan faster than a single string with a middle dot.
 * INPUT: { required, multiple } from product workflow
 * OUTPUT: Two inline chips (live: Badge; compact: neutral/blue StatusBadge, same as the comparison's other chips)
 * WHERE USED: DocumentList (default), ComparisonDocumentTitleRow (compact)
 */

import * as React from "react";
import { StatusBadge } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SupportingDocRowRequirementMeta } from "./supporting-documents-admin-meta";

export function SupportingDocRequirementBadges({
  meta,
  className,
  size = "default",
}: {
  meta: SupportingDocRowRequirementMeta;
  className?: string;
  /** comparison rows use a slightly tighter size */
  size?: "default" | "compact";
}) {
  const ariaLabel = `${meta.required ? "Required" : "Optional"}. ${meta.multiple ? "Multiple files allowed" : "Single file"}.`;

  if (size === "compact") {
    return (
      <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", className)} aria-label={ariaLabel}>
        <StatusBadge
          label={meta.required ? "Required" : "Optional"}
          status={meta.required ? "submitted" : "neutral"}
          size="sm"
          showDot={false}
        />
        <StatusBadge
          label={meta.multiple ? "Multiple files" : "Single file"}
          status={meta.multiple ? "submitted" : "neutral"}
          size="sm"
          showDot={false}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", className)}
      aria-label={ariaLabel}
    >
      <Badge variant={meta.required ? "default" : "secondary"}>
        {meta.required ? "Required" : "Optional"}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          meta.multiple
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border text-muted-foreground"
        )}
      >
        {meta.multiple ? "Multiple files" : "Single file"}
      </Badge>
    </div>
  );
}
