"use client";

import { DocumentTextIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  onReviewProspectus: () => void;
  /** Stacked layout for the note-detail rail. */
  layout?: "default" | "rail";
};

/**
 * Compact prospectus row on Note Detail. Title, badge, one sentence, one CTA —
 * marketplace publish stays on the lifecycle card.
 */
export function NoteProspectusStatusCard({
  note,
  onReviewProspectus,
  layout = "default",
}: NoteProspectusStatusCardProps) {
  const model = resolveProspectusStatusCard(note);
  const rail = layout === "rail";

  return (
    <Card
      data-prospectus-status-card
      data-prospectus-phase={model.phase}
      data-prospectus-emphasize={model.emphasize ? "true" : "false"}
      className={cn("rounded-2xl", model.emphasize && ADMIN_ACTION_SURFACE_CLASS)}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        {model.emphasize ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-status-action-bg text-status-action-text">
            <ExclamationTriangleIcon className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DocumentTextIcon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Prospectus</CardTitle>
            <StatusBadge
              label={model.badgeLabel}
              status={workflowToneToStatusToken(model.badgeTone)}
            />
          </div>
          <p className="text-ui text-muted-foreground">{model.description}</p>
        </div>
      </CardHeader>
      <CardContent
        className={cn(!rail && "flex flex-col sm:flex-row sm:justify-end")}
      >
        <Button
          type="button"
          variant={model.actionVariant}
          onClick={onReviewProspectus}
          className="w-full shrink-0 sm:w-auto"
        >
          <DocumentTextIcon className="mr-2 h-4 w-4" />
          {model.primaryLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
