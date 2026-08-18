"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { GetAdminNotesParams, NoteListItem, NoteStatus } from "@cashsouk/types";
import { AdminPageHeader } from "@/components/admin-page-header";
import { NotesTable } from "@/notes/components/notes-table";
import {
  NOTE_STATUS_FILTER_ACTIVE_LOANS,
  NotesTableToolbar,
} from "@/notes/components/notes-table-toolbar";
import { useCreateNoteFromInvoice, useNotes, useNoteSourceInvoices } from "@/notes/hooks/use-notes";
import { notesKeys } from "@/notes/query-keys";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";

export default function NotesPage() {
  const { can } = usePermissions();
  const canCreate = can("notes.create");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [status, setStatus] = React.useState<string>(NOTE_STATUS_FILTER_ACTIVE_LOANS);
  const [featuredOnly, setFeaturedOnly] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const params = React.useMemo(() => {
    const next: GetAdminNotesParams = { page: currentPage, pageSize };
    if (searchQuery) next.search = searchQuery;
    if (status === NOTE_STATUS_FILTER_ACTIVE_LOANS) {
      next.excludeFullySettledRegistryNotes = true;
    } else if (status !== "ALL") {
      next.status = status as NoteStatus;
    }
    if (featuredOnly) next.featuredOnly = true;
    return next;
  }, [currentPage, featuredOnly, pageSize, searchQuery, status]);

  const { data, isLoading, error } = useNotes(params);
  const { data: sourceInvoicesData, isLoading: sourceInvoicesLoading } = useNoteSourceInvoices();
  const createNote = useCreateNoteFromInvoice();

  React.useEffect(() => {
    setCurrentPage(1);
  }, [featuredOnly, searchQuery, status]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatus("ALL");
    setFeaturedOnly(false);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    if (value !== "ALL" && value !== NOTE_STATUS_FILTER_ACTIVE_LOANS) {
      setFeaturedOnly(false);
    }
  };

  const handleFeaturedOnlyChange = (value: boolean) => {
    setFeaturedOnly(value);
    if (value) setStatus("ALL");
  };

  const handleReload = () => {
    queryClient.invalidateQueries({ queryKey: notesKeys.all });
  };

  const handleViewDetails = (note: NoteListItem) => {
    router.push(`/notes/${note.id}`);
  };

  const handleCreateFromInvoice = async (invoiceId: string) => {
    try {
      const note = await createNote.mutateAsync({ invoiceId });
      toast.success("Draft note created");
      router.push(`/notes/${note.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create note");
    }
  };

  const notes = data?.notes ?? [];
  const totalNotes = data?.pagination.totalCount ?? 0;
  const sourceInvoices = sourceInvoicesData?.invoices ?? [];
  const readyInvoices = sourceInvoices.filter((invoice) => !invoice.noteId);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const readyInvoicesBySearch = readyInvoices.filter((invoice) => {
    if (!normalizedSearch) return true;
    return [
      invoice.invoiceId,
      invoice.invoiceNumber ?? "",
      invoice.issuerName ?? "",
      invoice.paymasterName ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  });
  const showReadyInvoices =
    (status === "ALL" || status === NOTE_STATUS_FILTER_ACTIVE_LOANS) && !featuredOnly;
  const readyInvoicesForDisplay = showReadyInvoices ? readyInvoicesBySearch : [];

  return (
    <RequirePermission permission="notes.view">
      <>
            <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <AdminPageHeader
              title="Notes"
              description="Turn approved invoices into notes, publish marketplace listings, and monitor servicing."
            />

            {error && (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                Error loading notes: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            <NotesTableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              status={status}
              onStatusChange={handleStatusChange}
              onClearFilters={handleClearFilters}
              onRefresh={handleReload}
              totalCount={totalNotes}
              isLoading={isLoading}
              featuredOnly={featuredOnly}
              onFeaturedOnlyChange={handleFeaturedOnlyChange}
            />

            <NotesTable
              notes={notes}
              readyInvoices={readyInvoicesForDisplay}
              loading={isLoading || sourceInvoicesLoading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalNotes={totalNotes}
              creatingInvoiceId={createNote.variables?.invoiceId ?? null}
              onPageChange={setCurrentPage}
              onViewDetails={handleViewDetails}
              onCreateNote={(invoice) => handleCreateFromInvoice(invoice.invoiceId)}
              canCreate={canCreate}
            />
          </section>
        </div>
      </div>
      </>
    </RequirePermission>
  );
}

