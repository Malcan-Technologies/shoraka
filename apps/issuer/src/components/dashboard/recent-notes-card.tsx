"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Card, NoteStatusBadge, isNoteFullySettled } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { RecentSectionHeader } from "@/components/dashboard/recent-section-header";

const MAX_ROWS = 4;

export function RecentNotesCard() {
  const { data, isLoading } = useIssuerNotes();
  const allNotes = data?.notes ?? [];

  const activeNotes = allNotes.filter((n) => !isNoteFullySettled(n));
  const sorted = activeNotes
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const visible = sorted.slice(0, MAX_ROWS);

  return (
    <Card className="bg-muted/50 shadow-none">
      <RecentSectionHeader title="Recent notes" viewAllHref="/notes" />
      <div className="px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
        {isLoading ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">
            No active notes yet. Funded invoices appear here as notes.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {visible.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {note.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{note.noteReference}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      Target {formatCurrency(note.targetAmount)} · Funded{" "}
                      {note.fundingPercent.toFixed(1)}%
                    </p>
                  </div>
                  <NoteStatusBadge note={note} className="shrink-0 text-xs font-semibold" />
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
