import * as React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { Progress } from "@cashsouk/ui";
import type { EligibleNoteInvoice, NoteListItem } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

type NotesTableRowProps =
  | {
      note: NoteListItem;
      readyInvoice?: never;
      creatingInvoiceId?: never;
      onViewDetails: (note: NoteListItem) => void;
      onCreateNote?: never;
    }
  | {
      note?: never;
      readyInvoice: EligibleNoteInvoice;
      creatingInvoiceId: string | null;
      onViewDetails?: never;
      onCreateNote: (invoice: EligibleNoteInvoice) => void;
    };

interface NoteRowProps {
  note: NoteListItem;
  onViewDetails: (note: NoteListItem) => void;
}

function formatDate(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy") : "—";
}

function getFundingProgressClass(fundingStatus: NoteListItem["fundingStatus"]) {
  if (fundingStatus === "FUNDED" || fundingStatus === "FAILED") {
    return "bg-muted [&>div]:bg-black";
  }
  return "[&>div]:bg-primary";
}

function NoteRow({ note, onViewDetails }: NoteRowProps) {
  const fundingProgress = Math.min(Math.max(note.fundingPercent, 0), 100);
  return (
    <TableRow>
      <TableCell className="min-w-0 overflow-hidden truncate font-mono text-xs" title={note.noteReference}>
        {note.noteReference}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-medium" title={note.title}>{note.title}</div>
        <div className="truncate text-xs text-muted-foreground" title={note.issuerName ?? "Unknown issuer"}>
          {note.issuerName ?? "Unknown issuer"}
        </div>
        <div className="mt-1">
          <Badge variant="outline" className="max-w-full truncate">
            Risk {note.riskRating ?? "-"}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate" title={note.paymasterName ?? "—"}>
        {note.paymasterName ?? "—"}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">{formatCurrency(note.targetAmount)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="shrink-0 font-medium">{note.fundingPercent.toFixed(1)}%</span>
          <span className="truncate text-xs text-muted-foreground">{note.fundingStatus.replace(/_/g, " ")}</span>
        </div>
        <Progress value={fundingProgress} className={`mt-2 h-2 ${getFundingProgressClass(note.fundingStatus)}`} />
        <div className="truncate text-xs text-muted-foreground">{formatCurrency(note.fundedAmount)} funded</div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <Badge variant="outline" className="max-w-full truncate">{note.status.replace(/_/g, " ")}</Badge>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        {note.settlementSummary ? (
          <div className="min-w-0">
            <Badge variant="secondary">Settled</Badge>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              Repayment {formatCurrency(note.settlementSummary.grossReceiptAmount)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Investor {formatCurrency(note.settlementSummary.investorPoolAmount)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Ops {formatCurrency(note.settlementSummary.operatingAccountAmount)} · Ta'widh{" "}
              {formatCurrency(note.settlementSummary.tawidhAccountAmount)} · Gharamah{" "}
              {formatCurrency(note.settlementSummary.gharamahAccountAmount)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">{formatDate(note.maturityDate)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <Button size="sm" variant="outline" className="w-full truncate px-2" onClick={() => onViewDetails(note)}>
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ReadyInvoiceRow({
  invoice,
  creatingInvoiceId,
  onCreateNote,
}: {
  invoice: EligibleNoteInvoice;
  creatingInvoiceId: string | null;
  onCreateNote: (invoice: EligibleNoteInvoice) => void;
}) {
  const invoiceLabel = invoice.invoiceNumber ?? invoice.invoiceId;
  return (
    <TableRow>
      <TableCell className="min-w-0 overflow-hidden truncate font-mono text-xs" title={invoiceLabel}>
        {invoiceLabel}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-medium" title={invoiceLabel}>Approved invoice ready for note</div>
        <div className="truncate text-xs text-muted-foreground" title={invoice.issuerName ?? invoice.issuerOrganizationId}>
          {invoice.issuerName ?? invoice.issuerOrganizationId}
        </div>
        <div className="mt-1">
          <Badge variant="outline" className="max-w-full truncate">
            Risk {invoice.riskRating ?? "-"}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate" title={invoice.paymasterName ?? "-"}>
        {invoice.paymasterName ?? "-"}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">
        {formatCurrency(invoice.offeredAmount ?? invoice.invoiceAmount)}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate text-sm text-muted-foreground">Not listed</div>
        <div className="mt-2 h-2 rounded-full bg-muted" />
        <div className="truncate text-xs text-muted-foreground">
          Profit {invoice.profitRatePercent == null ? "-" : `${invoice.profitRatePercent}%`}
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <Badge variant="secondary" className="max-w-full truncate">Ready</Badge>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">-</span>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">{formatDate(invoice.maturityDate)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <Button
          size="sm"
          className="w-full truncate px-2"
          onClick={() => onCreateNote(invoice)}
          disabled={creatingInvoiceId === invoice.invoiceId}
        >
          {creatingInvoiceId === invoice.invoiceId ? "Creating..." : "Turn Into Note"}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function NotesTableRow(props: NotesTableRowProps) {
  if (props.readyInvoice) {
    return (
      <ReadyInvoiceRow
        invoice={props.readyInvoice}
        creatingInvoiceId={props.creatingInvoiceId}
        onCreateNote={props.onCreateNote}
      />
    );
  }

  return <NoteRow note={props.note} onViewDetails={props.onViewDetails} />;
}

