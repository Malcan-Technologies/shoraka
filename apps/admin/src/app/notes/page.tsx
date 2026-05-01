"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import type { GetAdminNotesParams, NoteListItem, NoteStatus } from "@cashsouk/types";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { NotesTable } from "@/notes/components/notes-table";
import { NotesTableToolbar } from "@/notes/components/notes-table-toolbar";
import { useCreateNoteFromInvoice, useNotes, useNoteSourceInvoices } from "@/notes/hooks/use-notes";
import { notesKeys } from "@/notes/query-keys";

export default function NotesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [status, setStatus] = React.useState("ALL");
  const [currentPage, setCurrentPage] = React.useState(1);
  const pageSize = 20;

  const params = React.useMemo(() => {
    const next: GetAdminNotesParams = { page: currentPage, pageSize };
    if (searchQuery) next.search = searchQuery;
    if (status !== "ALL") next.status = status as NoteStatus;
    return next;
  }, [currentPage, pageSize, searchQuery, status]);

  const { data, isLoading, error } = useNotes(params);
  const { data: sourceInvoicesData, isLoading: sourceInvoicesLoading } = useNoteSourceInvoices();
  const createNote = useCreateNoteFromInvoice();

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, status]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatus("ALL");
    setCurrentPage(1);
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

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Notes</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-8 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <DocumentTextIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Notes Registry</h2>
                <p className="text-sm text-muted-foreground">
                  Turn approved invoices into notes, publish marketplace listings, and monitor servicing.
                </p>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
                Error loading notes: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            )}

            <NotesTableToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              status={status}
              onStatusChange={setStatus}
              onClearFilters={handleClearFilters}
              onReload={handleReload}
              totalCount={totalNotes}
              isLoading={isLoading}
            />

            <NotesTable
              notes={notes}
              readyInvoices={readyInvoices}
              loading={isLoading || sourceInvoicesLoading}
              currentPage={currentPage}
              pageSize={pageSize}
              totalNotes={totalNotes}
              creatingInvoiceId={createNote.variables?.invoiceId ?? null}
              onPageChange={setCurrentPage}
              onViewDetails={handleViewDetails}
              onCreateNote={(invoice) => handleCreateFromInvoice(invoice.invoiceId)}
            />
          </section>
        </div>
      </div>
    </>
  );
}

