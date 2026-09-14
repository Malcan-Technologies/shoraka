"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { WorkflowStepTitle } from "@/notes/components/note-detail-ui-blocks";
import {
  workflowTaskSurfaceClass,
  workflowToneToStatusToken,
  type WorkflowStatusTone,
} from "@/notes/utils/workflow-status-tokens";

type Props = HTMLAttributes<HTMLDivElement> & {
  title: string;
  completeLabel: string;
  description: string;
  tone: WorkflowStatusTone;
  badgeLabel: string;
  version?: string | null;
  children?: ReactNode;
  actions?: ReactNode;
};

export function OfficialDocumentWorkflowPanel({
  title,
  completeLabel,
  description,
  tone,
  badgeLabel,
  version,
  children,
  actions,
  className,
  ...props
}: Props) {
  const complete = tone === "success";

  return (
    <div
      className={cn("rounded-xl border p-4", workflowTaskSurfaceClass(tone), className)}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-2">
        <WorkflowStepTitle complete={complete} completeLabel={completeLabel}>
          {title}
        </WorkflowStepTitle>
        {complete ? null : (
          <StatusBadge label={badgeLabel} status={workflowToneToStatusToken(tone)} />
        )}
        {version ? <span className="text-meta text-muted-foreground">Version {version}</span> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      {children}
      {actions ? (
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
