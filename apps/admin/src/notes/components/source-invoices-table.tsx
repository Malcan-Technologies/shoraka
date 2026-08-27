import { formatCurrency } from "@cashsouk/config";
import { Skeleton, StatusBadge } from "@cashsouk/ui";
import type { EligibleNoteInvoice } from "@cashsouk/types";
import { formatInvoiceReference, formatNamedEntityDisplay, formatNoteDateEnMy } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { formatNoteStatus } from "@/notes/utils/format-note-status";
import { getAdminStatusToken, adminActionRowClass } from "@/lib/admin-status-token";
import { EyeIcon } from "@heroicons/react/24/outline";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SourceInvoicesTableProps {
  invoices: EligibleNoteInvoice[];
  loading: boolean;
  creatingInvoiceId: string | null;
  onCreateNote: (invoice: EligibleNoteInvoice) => void;
  onViewNote: (noteId: string) => void;
  canCreate?: boolean;
}

function formatDate(value: string | null) {
  return formatNoteDateEnMy(value) ?? "-";
}

function SourceInvoicesTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <TableRow key={index}>
          <TableCell><Skeleton className="h-5 w-40" /></TableCell>
          <TableCell><Skeleton className="h-5 w-36" /></TableCell>
          <TableCell><Skeleton className="h-5 w-36" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-8 w-28" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function SourceInvoicesTable({
  invoices,
  loading,
  creatingInvoiceId,
  onCreateNote,
  onViewNote,
  canCreate = true,
}: SourceInvoicesTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b p-4">
        <h3 className="font-semibold">Approved Invoices Ready for Notes</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Each approved invoice can become one investment note. Existing notes are shown for traceability.
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Issuer</TableHead>
              <TableHead>Paymaster</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Profit</TableHead>
              <TableHead>Invoice due date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <SourceInvoicesTableSkeleton />
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No approved invoices are ready for note creation.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow
                  key={invoice.invoiceId}
                  className={adminActionRowClass(
                    invoice.noteId
                      ? getAdminStatusToken(invoice.noteStatus ?? "")
                      : "action"
                  )}
                >
                  <TableCell>
                    <div className="font-medium font-mono text-xs">
                      {formatInvoiceReference({
                        displayReference: invoice.displayReference,
                        businessNumber: invoice.invoiceNumber,
                        id: invoice.invoiceId,
                      })}
                    </div>
                    {invoice.invoiceNumber ? (
                      <div className="text-xs text-muted-foreground">
                        Invoice no: {invoice.invoiceNumber}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {formatNamedEntityDisplay(
                      invoice.issuerName,
                      invoice.issuerOrganizationDisplayReference
                    )}
                  </TableCell>
                  <TableCell>{invoice.paymasterName ?? "-"}</TableCell>
                  <TableCell>
                    {formatCurrency(invoice.offeredAmount ?? invoice.invoiceAmount)}
                  </TableCell>
                  <TableCell>
                    {invoice.profitRatePercent == null ? "-" : `${invoice.profitRatePercent}%`}
                  </TableCell>
                  <TableCell>{formatDate(invoice.maturityDate)}</TableCell>
                  <TableCell>
                    {invoice.noteId ? (
                      <StatusBadge
                        label={formatNoteStatus(invoice.noteStatus)}
                        status={getAdminStatusToken(invoice.noteStatus ?? "")}
                      />
                    ) : (
                      <StatusBadge label="Ready" status="action" />
                    )}
                  </TableCell>
                  <TableCell>
                    {invoice.noteId ? (
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onViewNote(invoice.noteId!)}>
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={!canCreate ? "inline-flex cursor-not-allowed" : undefined}>
                              <Button
                                size="sm"
                                onClick={() => onCreateNote(invoice)}
                                disabled={creatingInvoiceId === invoice.invoiceId || !canCreate}
                              >
                                {creatingInvoiceId === invoice.invoiceId ? "Creating..." : "Turn Into Note"}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canCreate && (
                            <TooltipContent side="bottom" className="max-w-xs">
                              You do not have permission to perform this action.
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

