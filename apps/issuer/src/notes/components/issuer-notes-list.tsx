"use client";

import * as React from "react";
import Link from "next/link";
import type { NoteListItem } from "@cashsouk/types";
import {
  EmptyState,
  ListToolbar,
  ListToolbarFilterTrigger,
  LoadingState,
  isNoteFullySettled,
  type FilterChip,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { DashboardNoteCard } from "@/components/financing/note-card";
import { NoteAttentionCard } from "@/components/financing/note-attention-card";
import { FinancingAttentionList } from "@/components/financing/needs-attention-section";
import {
  isIssuerNoteActionable,
  partitionByActionable,
} from "@/lib/issuer-financing-actionable";

const ISSUER_NOTES_FILTER_ALL = "ALL" as const;
const ISSUER_NOTES_FILTER_EXCLUDE_SETTLED = "EXCLUDE_SETTLED" as const;

const ISSUER_NOTES_SEARCH_PLACEHOLDER = "Search notes, reference, paymaster, or application";

function issuerNoteSearchHaystack(note: NoteListItem): string {
  return [
    note.id,
    note.noteReference,
    note.title,
    note.purposeOfFinancing ?? "",
    note.paymasterName ?? "",
    note.productName ?? "",
    note.productCategory ?? "",
    note.sourceApplicationId,
    note.sourceInvoiceId ?? "",
    note.sourceContractId ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Notes list body used by the legacy /notes route if the redirect is bypassed. */
export function IssuerNotesList() {
  const { data, isLoading, error, refetch } = useIssuerNotes();
  const [listFilter, setListFilter] = React.useState<string>(ISSUER_NOTES_FILTER_ALL);
  const [searchQuery, setSearchQuery] = React.useState("");

  const allNotes = React.useMemo(() => data?.notes ?? [], [data?.notes]);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const notesAfterSettlementFilter = React.useMemo(() => {
    if (listFilter !== ISSUER_NOTES_FILTER_EXCLUDE_SETTLED) return allNotes;
    return allNotes.filter((n) => !isNoteFullySettled(n));
  }, [allNotes, listFilter]);

  const displayNotes = React.useMemo(() => {
    if (!normalizedSearch) return notesAfterSettlementFilter;
    return notesAfterSettlementFilter.filter((note) =>
      issuerNoteSearchHaystack(note).includes(normalizedSearch)
    );
  }, [notesAfterSettlementFilter, normalizedSearch]);

  const orderedNotes = React.useMemo(() => {
    const { attention, rest } = partitionByActionable(displayNotes, isIssuerNoteActionable);
    return { attention, rest };
  }, [displayNotes]);

  const activeFilterCount = listFilter === ISSUER_NOTES_FILTER_EXCLUDE_SETTLED ? 1 : 0;
  const hasFilters = searchQuery !== "" || listFilter !== ISSUER_NOTES_FILTER_ALL;

  const handleClearFilters = () => {
    setListFilter(ISSUER_NOTES_FILTER_ALL);
    setSearchQuery("");
  };

  const appliedFilters = React.useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (listFilter === ISSUER_NOTES_FILTER_EXCLUDE_SETTLED) {
      chips.push({
        id: "active",
        label: "Active (exclude settled)",
        onRemove: () => setListFilter(ISSUER_NOTES_FILTER_ALL),
      });
    }
    return chips;
  }, [listFilter]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load notes"}
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState variant="cards" rows={3} />;
  }

  return (
    <>
      <ListToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={ISSUER_NOTES_SEARCH_PLACEHOLDER}
        appliedFilters={appliedFilters}
        onClearFilters={hasFilters ? handleClearFilters : undefined}
        onReload={() => {
          void refetch();
        }}
        isLoading={isLoading}
        countLabel={`${displayNotes.length} ${displayNotes.length === 1 ? "note" : "notes"}${
          hasFilters ? ` of ${allNotes.length}` : ""
        }`}
        filterGroups={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ListToolbarFilterTrigger label="Filters" count={activeFilterCount} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={listFilter === ISSUER_NOTES_FILTER_ALL}
                onCheckedChange={(checked) => {
                  if (checked) setListFilter(ISSUER_NOTES_FILTER_ALL);
                }}
              >
                All notes
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={listFilter === ISSUER_NOTES_FILTER_EXCLUDE_SETTLED}
                onCheckedChange={(checked) => {
                  if (checked) setListFilter(ISSUER_NOTES_FILTER_EXCLUDE_SETTLED);
                }}
              >
                Active (exclude settled)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {!allNotes.length ? (
        <EmptyState
          title="No notes yet"
          message="Notes appear here after an invoice is approved and listed for funding."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/applications/new">Apply for financing</Link>
            </Button>
          }
        />
      ) : !displayNotes.length ? (
        <EmptyState
          variant="no-results"
          title="No matching notes"
          message="Try clearing filters or adjusting your search."
          action={
            <Button variant="outline" className="rounded-xl" onClick={handleClearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <FinancingAttentionList
          attentionCount={orderedNotes.attention.length}
          itemLabelPlural="notes"
          carouselLabel="Notes that need your attention"
          attentionItems={orderedNotes.attention.map((note) => ({
            key: note.id,
            node: <NoteAttentionCard note={note} />,
          }))}
          restItems={orderedNotes.rest.map((note) => ({
            key: note.id,
            node: <DashboardNoteCard note={note} />,
          }))}
        />
      )}
    </>
  );
}
