"use client";

import * as React from "react";
import { useHeader } from "@cashsouk/ui";
import { Input } from "@/components/ui/input";
import { NoteCard } from "@/investments/components/note-card";
import { useMarketplaceNotes } from "@/investments/hooks/use-marketplace-notes";

export default function InvestmentsPage() {
  const { setTitle } = useHeader();
  const [search, setSearch] = React.useState("");
  const { data, isLoading, error } = useMarketplaceNotes(search);

  React.useEffect(() => {
    setTitle("Investments");
  }, [setTitle]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Investment Marketplace</h1>
          <p className="mt-1 text-muted-foreground">
            Browse published notes and commit funds from your investor pool.
          </p>
        </div>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes"
          className="max-w-md"
        />
        {error && (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load marketplace"}
          </div>
        )}
        {isLoading ? (
          <div className="text-muted-foreground">Loading marketplace...</div>
        ) : data?.notes.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No marketplace notes are available right now.
          </div>
        )}
      </div>
    </div>
  );
}

