"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import type { NoteDetail } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  useGenerateArrearsLetter,
  useGenerateDefaultLetter,
  useMarkNoteDefault,
} from "../hooks/use-notes";

export function LateDefaultPanel({ note }: { note: NoteDetail }) {
  const [reason, setReason] = React.useState("");
  const arrearsLetter = useGenerateArrearsLetter();
  const defaultLetter = useGenerateDefaultLetter();
  const markDefault = useMarkNoteDefault();
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();

  const generatedLetters = React.useMemo(() => {
    return note.events
      .filter((event) => event.eventType === "ARREARS_LETTER_GENERATED" || event.eventType === "DEFAULT_LETTER_GENERATED")
      .map((event) => {
        const s3Key = event.metadata?.s3Key;
        return {
          id: event.id,
          type: event.eventType === "ARREARS_LETTER_GENERATED" ? "Arrears" : "Default",
          s3Key: typeof s3Key === "string" ? s3Key : null,
          createdAt: event.createdAt,
        };
      });
  }, [note.events]);

  const handleLetter = async (kind: "arrears" | "default") => {
    try {
      const result =
        kind === "arrears"
          ? await arrearsLetter.mutateAsync(note.id)
          : await defaultLetter.mutateAsync(note.id);
      toast.success(`${kind === "arrears" ? "Arrears" : "Default"} letter generated: ${result.s3Key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate letter");
    }
  };

  const handleMarkDefault = async () => {
    if (!reason.trim()) {
      toast.error("Default reason is required");
      return;
    }
    try {
      await markDefault.mutateAsync({ id: note.id, reason });
      setReason("");
      toast.success("Note marked as default");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark default");
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Late, Arrears, and Default</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div>
            <div className="text-muted-foreground">Grace period</div>
            <div className="font-medium">{note.gracePeriodDays} days</div>
          </div>
          <div>
            <div className="text-muted-foreground">Arrears threshold</div>
            <div className="font-medium">{note.arrearsThresholdDays} days after grace</div>
          </div>
          <div>
            <div className="text-muted-foreground">Late caps</div>
            <div className="font-medium">Ta'widh {note.tawidhRateCapPercent}%, Gharamah {note.gharamahRateCapPercent}%</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handleLetter("arrears")} disabled={arrearsLetter.isPending}>
            Generate Arrears Letter
          </Button>
          <Button variant="outline" onClick={() => handleLetter("default")} disabled={defaultLetter.isPending}>
            Generate Default Letter
          </Button>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Generated Letters</div>
              <div className="text-xs text-muted-foreground">
                Arrears and default PDFs generated for this note.
              </div>
            </div>
            {generatedLetters.length > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {generatedLetters.length}
              </Badge>
            ) : null}
          </div>
          {generatedLetters.length === 0 ? (
            <div className="mt-3 text-sm text-muted-foreground">No letters generated yet.</div>
          ) : (
            <div className="mt-3 space-y-2">
              {generatedLetters.map((letter) => (
                <div key={letter.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{letter.type} letter</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(letter.createdAt), "dd MMM yyyy, h:mm a")}
                      </div>
                      {letter.s3Key ? (
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {letter.s3Key}
                        </div>
                      ) : null}
                    </div>
                    {letter.s3Key ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={viewDocumentPending}
                          onClick={() => handleViewDocument(letter.s3Key!)}
                        >
                          <DocumentTextIcon className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          disabled={viewDocumentPending}
                          onClick={() =>
                            handleDownloadDocument(
                              letter.s3Key!,
                              `${letter.type.toLowerCase()}-letter-${note.noteReference}.pdf`
                            )
                          }
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Default reason" />
          <Button variant="destructive" onClick={handleMarkDefault} disabled={markDefault.isPending}>
            Mark Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

