import * as React from "react";
import { formatCurrency } from "@cashsouk/config";
import type { EligibleNoteInvoice } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-MY") : "-";
}

export function SourceInvoicesTable({
  invoices,
  loading,
  creatingInvoiceId,
  onCreateNote,
  onViewNote,
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
              <TableHead>Maturity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading approved invoices...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  No approved invoices are ready for note creation.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow key={invoice.invoiceId}>
                  <TableCell>
                    <div className="font-medium">{invoice.invoiceNumber ?? invoice.invoiceId}</div>
                    <div className="font-mono text-xs text-muted-foreground">{invoice.invoiceId}</div>
                  </TableCell>
                  <TableCell>{invoice.issuerName ?? invoice.issuerOrganizationId}</TableCell>
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
                      <Badge variant="outline">{invoice.noteStatus?.replace(/_/g, " ")}</Badge>
                    ) : (
                      <Badge variant="secondary">Ready</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {invoice.noteId ? (
                      <Button size="sm" variant="outline" onClick={() => onViewNote(invoice.noteId!)}>
                        View Note
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => onCreateNote(invoice)}
                        disabled={creatingInvoiceId === invoice.invoiceId}
                      >
                        {creatingInvoiceId === invoice.invoiceId ? "Creating..." : "Turn Into Note"}
                      </Button>
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

