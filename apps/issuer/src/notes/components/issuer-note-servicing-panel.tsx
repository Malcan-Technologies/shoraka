"use client";

import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatCurrency, getUserPortalStatusToken } from "@cashsouk/config";
import {
  formatNoteDateEnMy,
  NoteServicingLetterType,
  type NoteDetail,
  type NoteLateChargeWaiver,
  type NoteServicingLetter,
} from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle, StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { useViewIssuerServicingLetter } from "@/notes/hooks/use-issuer-notes";
import { toast } from "sonner";

function formatServicingStatusLabel(status: string): string {
  if (status === "OVERDUE") return "Overdue";
  if (status === "ADVANCE_PAID") return "Advance paid";
  if (status === "NOT_STARTED") return "Not started";
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function servicingLetterLabel(type: NoteServicingLetter["type"]): string {
  return type === NoteServicingLetterType.DEFAULT ? "Default Notice" : "Arrears Notice";
}

function latestWaiver(waivers: NoteLateChargeWaiver[] | undefined): NoteLateChargeWaiver | null {
  if (!waivers || waivers.length === 0) return null;
  return [...waivers].sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function waiverCopy(waiver: NoteLateChargeWaiver): string {
  const parts: string[] = [];
  if (waiver.tawidhWaivedAmount > 0.005) {
    parts.push(`indicative Ta'widh ${formatCurrency(waiver.tawidhWaivedAmount)}`);
  }
  if (waiver.gharamahWaivedAmount > 0.005) {
    parts.push(`indicative Gharamah ${formatCurrency(waiver.gharamahWaivedAmount)}`);
  }
  const amounts = parts.length > 0 ? ` ${parts.join(" and ")}` : "";
  return `Admin waived${amounts}. ${waiver.reason}`;
}

export function IssuerNoteServicingPanel({ note }: { note: NoteDetail }) {
  const viewLetter = useViewIssuerServicingLetter(note.id);
  const dpd = Number(note.daysPastDue ?? 0);
  const tawidh = Number(note.indicativeTawidhAmount ?? 0);
  const gharamah = Number(note.indicativeGharamahAmount ?? 0);
  const asOf = formatNoteDateEnMy(note.indicativeAsOf);
  const waiver = latestWaiver(note.lateChargeWaivers);
  const letters = note.servicingLetters ?? [];
  const showIndicative = tawidh > 0.005 || gharamah > 0.005 || dpd > 0;

  const openLetter = async (letterId: string) => {
    try {
      const result = await viewLetter.mutateAsync(letterId);
      if (result.viewUrl) {
        window.open(result.viewUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open servicing letter");
    }
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Servicing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-meta text-muted-foreground">Servicing status</div>
              <div className="mt-2">
                <StatusBadge
                  label={formatServicingStatusLabel(note.servicingStatus)}
                  status={getUserPortalStatusToken(note.servicingStatus)}
                />
              </div>
            </div>
            <div>
              <div className="text-meta text-muted-foreground">Days past due</div>
              <div className="mt-1 text-ui font-medium tabular-nums text-foreground">
                {dpd > 0 ? dpd : "—"}
              </div>
            </div>
            {showIndicative ? (
              <>
                <div>
                  <div className="text-meta text-muted-foreground">Indicative Ta&apos;widh</div>
                  <div className="mt-1 text-ui font-medium tabular-nums text-foreground">
                    {formatCurrency(tawidh)}
                  </div>
                </div>
                <div>
                  <div className="text-meta text-muted-foreground">Indicative Gharamah</div>
                  <div className="mt-1 text-ui font-medium tabular-nums text-foreground">
                    {formatCurrency(gharamah)}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          {asOf ? (
            <p className="text-ui text-muted-foreground">Indicative as of {asOf}.</p>
          ) : null}
          {waiver ? (
            <p className="text-ui leading-6 text-muted-foreground" role="status">
              {waiverCopy(waiver)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {letters.length > 0 ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {letters.map((letter) => (
              <div
                key={letter.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <DocumentTextIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-ui font-medium text-foreground">
                      {servicingLetterLabel(letter.type)}
                    </p>
                    <p className="text-meta text-muted-foreground">
                      Issued {formatNoteDateEnMy(letter.generatedAt) ?? "—"}
                      {letter.sentAt
                        ? ` · Sent ${formatNoteDateEnMy(letter.sentAt) ?? ""}`.trimEnd()
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={viewLetter.isPending}
                  onClick={() => {
                    void openLetter(letter.id);
                  }}
                >
                  View
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
