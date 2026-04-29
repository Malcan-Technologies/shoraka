"use client";

import * as React from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@cashsouk/ui";
import { useNoteDetail } from "../hooks/use-note-detail";
import {
  useActivateNote,
  useCloseNoteFunding,
  useFailNoteFunding,
  usePublishNote,
  useUnpublishNote,
} from "../hooks/use-notes";
import { SourceApplicationPanel } from "./source-application-panel";
import { NoteTermsPanel } from "./note-terms-panel";
import { NoteTimelinePanel } from "./note-timeline-panel";
import { SettlementPanel } from "./settlement-panel";
import { LateDefaultPanel } from "./late-default-panel";
import { LedgerPanel } from "./ledger-panel";

interface NoteDetailModalProps {
  noteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoteDetailModal({ noteId, open, onOpenChange }: NoteDetailModalProps) {
  const { data: note, isLoading, error } = useNoteDetail(open ? (noteId ?? undefined) : undefined);
  const publishNote = usePublishNote();
  const unpublishNote = useUnpublishNote();
  const closeFunding = useCloseNoteFunding();
  const failFunding = useFailNoteFunding();
  const activateNote = useActivateNote();

  const handlePublish = async () => {
    if (!note) return;
    try {
      await publishNote.mutateAsync(note.id);
      toast.success("Note published to marketplace");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish note");
    }
  };

  const handleAction = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
      toast.success(label);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleUnpublish = async () => {
    if (!note) return;
    try {
      await unpublishNote.mutateAsync(note.id);
      toast.success("Note unpublished");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unpublish note");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle>{note?.title ?? "Note detail"}</DialogTitle>
          <DialogDescription>
            {note?.noteReference ?? "Review source data, terms, marketplace status, and audit trail."}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load note"}
          </div>
        ) : note ? (
          <ScrollArea className="max-h-[72vh] pr-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{note.status.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">{note.listingStatus.replace(/_/g, " ")}</Badge>
                  <Badge variant="secondary">{note.fundingStatus.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={publishNote.isPending || note.status === "PUBLISHED"}
                  >
                    Publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUnpublish}
                    disabled={unpublishNote.isPending || note.investments.length > 0}
                  >
                    Unpublish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("Funding closed", () => closeFunding.mutateAsync(note.id))}
                    disabled={closeFunding.isPending || note.fundingStatus !== "OPEN"}
                  >
                    Close Funding
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("Funding failed", () => failFunding.mutateAsync(note.id))}
                    disabled={failFunding.isPending || note.fundingStatus !== "OPEN"}
                  >
                    Fail Funding
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("Note activated", () => activateNote.mutateAsync(note.id))}
                    disabled={activateNote.isPending || note.fundingStatus !== "FUNDED"}
                  >
                    Activate
                  </Button>
                </div>
              </div>
              <SourceApplicationPanel note={note} />
              <NoteTermsPanel note={note} />
              <SettlementPanel note={note} />
              <LateDefaultPanel note={note} />
              <LedgerPanel note={note} />
              <NoteTimelinePanel note={note} />
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

