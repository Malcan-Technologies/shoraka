import * as React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { Progress } from "@cashsouk/ui";
import type { EligibleNoteInvoice, NoteListItem } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatNoteStatus } from "@/notes/utils/format-note-status";
import {
  ArchiveBoxIcon,
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  PaperAirplaneIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

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

const noteStatusConfig: Record<
  string,
  {
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DRAFT: {
    className: "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
    icon: ClockIcon,
  },
  PUBLISHED: {
    className: "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
    icon: PaperAirplaneIcon,
  },
  FUNDING: {
    className: "border-transparent bg-status-in-progress-bg text-status-in-progress-text dark:bg-indigo-950/40 dark:text-indigo-300",
    icon: BanknotesIcon,
  },
  ACTIVE: {
    className: "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircleIcon,
  },
  REPAID: {
    className: "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    icon: CheckCircleIcon,
  },
  ARREARS: {
    className: "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
    icon: ExclamationTriangleIcon,
  },
  DEFAULTED: {
    className: "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
    icon: XCircleIcon,
  },
  FAILED_FUNDING: {
    className: "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
    icon: XCircleIcon,
  },
  CANCELLED: {
    className: "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    icon: ArchiveBoxIcon,
  },
};

function NoteStatusBadge({ status }: { status: string }) {
  const config = noteStatusConfig[status] ?? {
    className: "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    icon: ClockIcon,
  };
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`max-w-full truncate ${config.className}`}>
      <Icon className="mr-1 h-3.5 w-3.5 shrink-0" />
      {formatNoteStatus(status)}
    </Badge>
  );
}

function RiskBadge({ riskRating }: { riskRating: string | null | undefined }) {
  const riskClass =
    riskRating === "AAA" || riskRating === "AA"
      ? "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300"
      : riskRating === "A" || riskRating === "BBB"
        ? "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300"
        : riskRating === "BB"
          ? "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300"
          : riskRating === "B"
            ? "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300"
            : "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300";

  return (
    <Badge variant="outline" className={`max-w-full truncate ${riskClass}`}>
      {riskRating ?? "-"}
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
        <RiskBadge riskRating={note.riskRating} />
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
        <Progress value={fundingProgress} className={`mt-2 h-2 ${getFundingProgressClass(note.fundingStatus)}`} />
        <div className="truncate text-xs text-muted-foreground">{formatCurrency(note.fundedAmount)} funded</div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <NoteStatusBadge status={note.status} />
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
              Ops {formatCurrency(note.settlementSummary.operatingAccountAmount)} · Ta&apos;widh{" "}
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
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <RiskBadge riskRating={invoice.riskRating} />
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
        <Badge
          variant="outline"
          className="max-w-full truncate border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300"
        >
          <CheckCircleIcon className="mr-1 h-3.5 w-3.5 shrink-0" />
          Ready
        </Badge>
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

