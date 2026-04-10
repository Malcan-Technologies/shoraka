/**
 * SECTION: Workflow requirement badges for supporting document rows
 * WHY: Badges scan faster than a single string with a middle dot.
 * INPUT: { required, multiple } from product workflow
 * OUTPUT: Two inline Badge chips
 * WHERE USED: DocumentList, ComparisonDocumentTitleRow
 */

import * as React from "react";
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
  const compact = size === "compact";
  const badgeCn = cn(
    compact ? "h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide" : "font-semibold"
  );

  return (
    <div
      className={cn("mt-1.5 flex flex-wrap items-center gap-1.5", className)}
      aria-label={`${meta.required ? "Required" : "Optional"}. ${meta.multiple ? "Multiple files allowed" : "Single file"}.`}
    >
      <Badge variant={meta.required ? "default" : "secondary"} className={badgeCn}>
        {meta.required ? "Required" : "Optional"}
      </Badge>
      <Badge
        variant="outline"
        className={cn(
          badgeCn,
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
