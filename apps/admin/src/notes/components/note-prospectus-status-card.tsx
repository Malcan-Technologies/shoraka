"use client";

import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { workflowToneToStatusToken } from "@/notes/utils/workflow-status-tokens";
import { resolveProspectusStatusCard } from "./note-prospectus-status-card.model";

export {
  resolveProspectusStatusCard,
  type ProspectusNoteDetailPhase,
  type ProspectusStatusCardModel,
  type ProspectusStatusCardActionVariant,
} from "./note-prospectus-status-card.model";

type NoteProspectusStatusCardProps = {
  note: NoteDetail;
  onOpenWorkspace: () => void;
  onViewProspectus?: () => void;
  viewPending?: boolean;
};

/**
 * Compact prospectus row on Note Detail. Title, badge, one sentence, workspace + View.
 * Marketplace publish stays on the campaign card.
 */
export function NoteProspectusStatusCard({
  note,
  onOpenWorkspace,
  onViewProspectus,
  viewPending = false,
}: NoteProspectusStatusCardProps) {
  const model = resolveProspectusStatusCard(note);
  const WorkspaceIcon = model.phase === "approved" ? PencilSquareIcon : DocumentTextIcon;

  return (
    <Card
      data-prospectus-status-card
      data-prospectus-phase={model.phase}
      data-prospectus-emphasize={model.emphasize ? "true" : "false"}
      className={cn("rounded-2xl", model.emphasize && ADMIN_ACTION_SURFACE_CLASS)}
    >
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {model.emphasize ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-action-bg text-status-action-text">
                <ExclamationTriangleIcon className="h-4 w-4" aria-hidden />
              </span>
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <DocumentTextIcon className="h-4 w-4" aria-hidden />
              </span>
            )}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle>Prospectus</CardTitle>
              <StatusBadge
                label={model.badgeLabel}
                status={workflowToneToStatusToken(model.badgeTone)}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {model.viewAvailable ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onViewProspectus}
                disabled={!onViewProspectus || viewPending}
                className="shrink-0 gap-1.5"
              >
                {viewPending ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                )}
                View
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant={model.actionVariant}
              onClick={onOpenWorkspace}
              className="shrink-0 gap-1.5"
            >
              <WorkspaceIcon className="h-4 w-4" />
              {model.workspaceLabel}
            </Button>
          </div>
        </div>
        <p className="text-ui text-muted-foreground pl-12">{model.description}</p>
      </CardHeader>
    </Card>
  );
}
