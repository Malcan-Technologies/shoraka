"use client";

import * as React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  resolveProspectusStatusCard,
} from "./note-prospectus-status-card.model";

export {
  resolveProspectusStatusCard,
  type ProspectusNoteDetailPhase,
  type ProspectusStatusCardModel,
} from "./note-prospectus-status-card.model";

const EMPHASIS_CARD_CLASS =
  "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]";

type NoteProspectusStatusCardProps = {
  note: NoteDetail;
  onReviewProspectus: () => void;
};

/**
 * Prospectus status on Note Detail. Marketplace publish lives only on Note Lifecycle.
 */
export function NoteProspectusStatusCard({
  note,
  onReviewProspectus,
}: NoteProspectusStatusCardProps) {
  const model = resolveProspectusStatusCard(note);

  return (
    <Card
      data-prospectus-status-card
      data-prospectus-phase={model.phase}
      className={cn("rounded-2xl", model.emphasize && EMPHASIS_CARD_CLASS)}
    >
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Prospectus</div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{model.heading}</h3>
            <Badge variant="outline" className="font-normal">
              {model.badgeLabel}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{model.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="default" onClick={onReviewProspectus}>
            <DocumentTextIcon className="mr-2 h-4 w-4" />
            {model.primaryLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
