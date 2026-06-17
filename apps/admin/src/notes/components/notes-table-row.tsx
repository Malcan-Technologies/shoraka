import * as React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  Progress,
  SoukscoreRiskRatingBadge,
  NOTE_STATUS_BADGE_TONE_CLASS,
  NoteStatusBadge,
} from "@cashsouk/ui";
import type { EligibleNoteInvoice, NoteListItem } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatNoteStatus } from "@/notes/utils/format-note-status";
import { cn } from "@/lib/utils";
import { CheckCircleIcon, EyeIcon } from "@heroicons/react/24/outline";

type NotesTableRowProps =
  | {
      note: NoteListItem;
      readyInvoice?: never;
      creatingInvoiceId?: never;
      onViewDetails: (note: NoteListItem) => void;
      onCreateNote?: never;
      canCreate?: never;
    }
  | {
      note?: never;
      readyInvoice: EligibleNoteInvoice;
      creatingInvoiceId: string | null;
      onViewDetails?: never;
      onCreateNote: (invoice: EligibleNoteInvoice) => void;
      canCreate?: boolean;
    };

interface NoteRowProps {
  note: NoteListItem;
  onViewDetails: (note: NoteListItem) => void;
}

function formatDate(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy") : "—";
}

function getFundingProgressClass(note: NoteListItem) {
  if (note.status === "REPAID") {
    return "bg-muted [&>div]:bg-emerald-500";
  }
  if (note.fundingStatus === "FUNDED" || note.fundingStatus === "FAILED") {
    return "bg-muted [&>div]:bg-black";
  }
  return "[&>div]:bg-primary";
}

function ServiceFeeTrusteeRegistryCell({ note }: { note: NoteListItem }) {
  const summary = note.settlementSummary;
  if (!summary || summary.status !== "POSTED" || summary.operatingAccountAmount <= 0.005) {
    return <span className="text-muted-foreground">—</span>;
  }
  const st = summary.serviceFeeTrusteeStatus;
  if (st === "COMPLETED") {
    return (
      <Badge variant="outline" className={cn("max-w-full truncate", NOTE_STATUS_BADGE_TONE_CLASS.success)}>
        Complete
      </Badge>
    );
  }
  if (st === "SUBMITTED_TO_TRUSTEE") {
    return (
      <Badge variant="outline" className={cn("max-w-full truncate", NOTE_STATUS_BADGE_TONE_CLASS.info)}>
        Submitted
      </Badge>
    );
  }
  if (st === "LETTER_GENERATED") {
    return (
      <Badge variant="outline" className="max-w-full truncate border-amber-200 text-amber-900">
        Letter
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full truncate", NOTE_STATUS_BADGE_TONE_CLASS.destructive)}
    >
      PDF pending
    </Badge>
  );
}

function NoteRow({ note, onViewDetails }: NoteRowProps) {
  const fundingProgress = Math.min(Math.max(note.fundingPercent, 0), 100);
  return (
    <TableRow>
      <TableCell className="min-w-0 overflow-hidden truncate font-mono text-xs" title={note.noteReference}>
        {note.noteReference}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate font-medium" title={note.title}>{note.title}</div>
          {note.isFeatured ? (
            <Badge
              variant="secondary"
              className="shrink-0 border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              Featured
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground" title={note.issuerName ?? "Unknown issuer"}>
          {note.issuerName ?? "Unknown issuer"}
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <SoukscoreRiskRatingBadge riskRating={note.riskRating} />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate" title={note.paymasterName ?? "—"}>
        {note.paymasterName ?? "—"}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">{formatCurrency(note.targetAmount)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="shrink-0 font-medium">{note.fundingPercent.toFixed(1)}%</span>
          <span className="truncate text-xs text-muted-foreground">{formatNoteStatus(note.fundingStatus)}</span>
        </div>
        <Progress value={fundingProgress} className={`mt-2 h-2 ${getFundingProgressClass(note)}`} />
        <div className="truncate text-xs text-muted-foreground">{formatCurrency(note.fundedAmount)} funded</div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <NoteStatusBadge note={note} />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        {note.settlementSummary ? (
          <div className="min-w-0">
            <Badge variant="outline" className={NOTE_STATUS_BADGE_TONE_CLASS.success}>
              Settled
            </Badge>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              Repayment {formatCurrency(note.settlementSummary.grossReceiptAmount)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Investor {formatCurrency(note.settlementSummary.investorPoolAmount)}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              Ops {formatCurrency(note.settlementSummary.operatingAccountAmount)} · Ta&apos;widh{" "}
              {formatCurrency(note.settlementSummary.tawidhAccountAmount)} · Gharamah{" "}
              {formatCurrency(note.settlementSummary.gharamahAccountAmount)}
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <ServiceFeeTrusteeRegistryCell note={note} />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">{formatDate(note.maturityDate)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => onViewDetails(note)}>
          <EyeIcon className="h-4 w-4 mr-1" />
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
  canCreate = true,
}: {
  invoice: EligibleNoteInvoice;
  creatingInvoiceId: string | null;
  onCreateNote: (invoice: EligibleNoteInvoice) => void;
  canCreate?: boolean;
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
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <SoukscoreRiskRatingBadge riskRating={invoice.riskRating} />
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
        <Badge variant="outline" className={cn("max-w-full truncate", NOTE_STATUS_BADGE_TONE_CLASS.info)}>
          <CheckCircleIcon className="mr-1 h-3.5 w-3.5 shrink-0" />
          Ready
        </Badge>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">-</span>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">—</span>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden truncate">{formatDate(invoice.maturityDate)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={!canCreate ? "inline-flex w-full cursor-not-allowed" : "w-full"}>
                <Button
                  size="sm"
                  className="w-full truncate px-2"
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
        canCreate={props.canCreate}
      />
    );
  }

  return <NoteRow note={props.note} onViewDetails={props.onViewDetails} />;
}

