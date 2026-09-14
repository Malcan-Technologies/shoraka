"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDownTrayIcon, ArrowPathIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { NoteDetail, NoteServicingLetter } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  useAdminNoteServicingLetterViewUrl,
  useResendNoteServicingLetter,
} from "@/notes/hooks/use-notes";

function letterLabel(letter: NoteServicingLetter) {
  return letter.type === "DEFAULT" ? "Default notice" : "Arrears notice";
}

export function NoteServicingLettersList({
  note,
  canManage,
}: {
  note: NoteDetail;
  canManage: boolean;
}) {
  const letters = note.servicingLetters ?? [];
  const viewUrl = useAdminNoteServicingLetterViewUrl();
  const resend = useResendNoteServicingLetter();

  const openLetter = async (letter: NoteServicingLetter, download: boolean) => {
    try {
      const result = await viewUrl.mutateAsync({ noteId: note.id, letterId: letter.id });
      if (download) {
        const response = await fetch(result.viewUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${letter.type.toLowerCase()}-letter-${note.noteReference}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }
      window.open(result.viewUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to open letter");
    }
  };

  const handleResend = async (letter: NoteServicingLetter) => {
    try {
      await resend.mutateAsync({ noteId: note.id, letterId: letter.id });
      toast.success("Letter resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend letter");
    }
  };

  if (letters.length === 0) {
    return <p className="text-ui text-muted-foreground">No servicing letters yet.</p>;
  }

  return (
    <div className="space-y-2">
      {letters.map((letter) => (
        <div key={letter.id} className="rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{letterLabel(letter)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(letter.generatedAt), "dd MMM yyyy, h:mm a")}
                {letter.triggeredBy === "SYSTEM" ? " · System" : " · Admin"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={viewUrl.isPending}
                onClick={() => void openLetter(letter, false)}
              >
                <DocumentTextIcon className="h-3.5 w-3.5" />
                View
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={viewUrl.isPending}
                onClick={() => void openLetter(letter, true)}
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                disabled={!canManage || resend.isPending}
                onClick={() => void handleResend(letter)}
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Resend
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
