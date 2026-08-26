import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  NoteStatusBadge,
  Progress,
  SoukscoreRiskRatingBadge,
  StatusBadge,
  getNoteDerivedStatusToken,
} from "@cashsouk/ui";
import { resolveNoteTimingDisplay, type EligibleNoteInvoice, type NoteListItem } from "@cashsouk/types";
import {
  formatInvoiceReference,
  formatNamedEntityDisplay,
  formatProspectusListBadge,
  isNoteSettlementPosted,
  resolveSettlementTrusteeRegistryState,
  settlementTrusteeRegistryLabel,
  settlementTrusteeRegistryNeedsAdminAction,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatNoteStatus } from "@/notes/utils/format-note-status";
import {
  getNoteFundingAccentClass,
  getNoteFundingIndicatorClass,
  getNoteFundingProgressClass,
} from "@/notes/utils/funding-progress";
import {
  calendarDaysUntilMaturity,
  formatMaturityCountdown,
  isActiveNearMaturity,
  isNoteInArrears,
  maturityCountdownClass,
} from "@/notes/utils/maturity-countdown";
import { EyeIcon } from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { adminActionRowClass, adminRejectedRowClass } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";
import { resolveNoteFacilityLink } from "@/notes/utils/note-source-linkage";

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
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "dd MMM yyyy");
}

function MaturityCell({
  maturityDate,
  tenureDays,
  highlightCountdown = true,
  settled = false,
  invoiceDue = false,
}: {
  maturityDate: string | null;
  tenureDays?: number | null;
  highlightCountdown?: boolean;
  settled?: boolean;
  invoiceDue?: boolean;
}) {
  const timing = resolveNoteTimingDisplay({ maturityDate, tenureDays });
  const parsedDate =
    timing.kind === "tenure_activated" || timing.kind === "legacy" ? maturityDate : null;
  const dateLabel = invoiceDue
    ? parsedDate
      ? formatDate(parsedDate)
      : "—"
    : timing.value;
  const countdown = invoiceDue
    ? "Invoice due date"
    : settled
      ? "Settled"
      : parsedDate
        ? formatMaturityCountdown(parsedDate)
        : null;
  const days = calendarDaysUntilMaturity(maturityDate);
  const title = countdown ? `${dateLabel} · ${countdown}` : dateLabel;
  const dateClass = maturityCountdownClass(days, {
    highlight: highlightCountdown,
    variant: "date",
    settled,
  });
  const countdownClass = maturityCountdownClass(days, {
    highlight: highlightCountdown,
    variant: "countdown",
    settled,
  });
  return (
    <TableCell className="min-w-0 overflow-hidden" title={title}>
      <div className={cn("truncate", dateClass)}>{dateLabel}</div>
      {countdown ? (
        <div className={cn("truncate text-xs", countdownClass)}>{countdown}</div>
      ) : null}
    </TableCell>
  );
}

function SettlementRegistryCell({ note }: { note: NoteListItem }) {
  if (!isNoteSettlementPosted(note)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <StatusBadge label="Settled" status="success" className="max-w-full truncate" />;
}

function TrusteeInstructionCell({ note }: { note: NoteListItem }) {
  const state = resolveSettlementTrusteeRegistryState(note.settlementSummary);
  const label = settlementTrusteeRegistryLabel(state);
  if (!label) {
    return <span className="text-muted-foreground">—</span>;
  }
  const status =
    state === "complete" ? "success" : state === "submitted" ? "submitted" : "action";
  return (
    <StatusBadge
      label={label}
      status={status}
      title={label}
      className="max-w-full truncate"
    />
  );
}

function noteRowNeedsAdminAction(note: NoteListItem): boolean {
  if (isNoteInArrears(note)) return false;
  if (getNoteDerivedStatusToken(note) === "action") return true;
  if (!isNoteSettlementPosted(note) && isActiveNearMaturity(note)) return true;
  return settlementTrusteeRegistryNeedsAdminAction(note.settlementSummary);
}

function noteRowHighlightClass(note: NoteListItem): string {
  if (isNoteInArrears(note)) return adminRejectedRowClass(true);
  return adminActionRowClass(noteRowNeedsAdminAction(note));
}

function hasProspectusIndicator(note: NoteListItem): boolean {
  return (
    note.prospectus?.displayStatus === "Approved" ||
    note.prospectus?.displayStatus === "Published"
  );
}

function ProspectusCell({ note }: { note?: NoteListItem }) {
  if (!note || !hasProspectusIndicator(note) || !note.prospectus) {
    return (
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">—</span>
      </TableCell>
    );
  }

  const label = formatProspectusListBadge(note.prospectus.displayStatus);
  return (
    <TableCell className="min-w-0 overflow-hidden">
      <CheckIcon
        className="size-4 shrink-0 text-status-success-text"
        title={label}
        aria-label={label}
      />
    </TableCell>
  );
}

function FacilityCell({
  contractId,
  displayReference,
}: {
  contractId: string | null;
  displayReference?: string | null;
}) {
  const facility = resolveNoteFacilityLink({ contractId, displayReference });
  if (!facility) {
    return (
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">—</span>
      </TableCell>
    );
  }
  return (
    <TableCell className="min-w-0 overflow-hidden" title={facility.label}>
      <Link
        href={facility.href}
        className="block truncate font-mono text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        {facility.label}
      </Link>
    </TableCell>
  );
}

function NoteRow({ note, onViewDetails }: NoteRowProps) {
  const fundingProgress = Math.min(Math.max(note.fundingPercent, 0), 100);
  const settlementPosted = isNoteSettlementPosted(note);
  return (
    <TableRow className={noteRowHighlightClass(note)}>
      <TableCell className="min-w-0 overflow-hidden" title={note.noteReference}>
        <div className="truncate font-mono text-xs">{note.noteReference}</div>
        {note.isFeatured ? (
          <StatusBadge
            label="Featured"
            status="active"
            showDot={false}
            className="mt-1 shrink-0"
          />
        ) : null}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-medium" title={note.title}>{note.title}</div>
        <div className="truncate text-xs text-muted-foreground" title={note.issuerName ?? "Unknown issuer"}>
          {note.issuerName ?? "Unknown issuer"}
        </div>
      </TableCell>
      <ProspectusCell note={note} />
      <TableCell className="min-w-0 overflow-hidden">
        <SoukscoreRiskRatingBadge riskRating={note.riskRating} />
      </TableCell>
      <FacilityCell
        contractId={note.sourceContractId}
        displayReference={note.sourceContractDisplayReference}
      />
      <TableCell className="min-w-0 overflow-hidden truncate">{formatCurrency(note.settlementAmount)}</TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <span className="shrink-0 font-medium">{note.fundingPercent.toFixed(1)}%</span>
          <span
            className={cn(
              "truncate text-xs",
              getNoteFundingAccentClass(note) ?? "text-muted-foreground"
            )}
          >
            {formatNoteStatus(note.fundingStatus)}
          </span>
        </div>
        <Progress
          value={fundingProgress}
          className={cn("mt-2 h-2", getNoteFundingProgressClass(note))}
          indicatorClassName={getNoteFundingIndicatorClass(note)}
        />
        <div
          className={cn(
            "truncate text-xs",
            getNoteFundingAccentClass(note) ?? "text-muted-foreground"
          )}
        >
          {formatCurrency(note.fundedAmount)} funded
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <NoteStatusBadge note={note} marker="dot" />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <SettlementRegistryCell note={note} />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <TrusteeInstructionCell note={note} />
      </TableCell>
      <MaturityCell
        maturityDate={note.maturityDate}
        tenureDays={note.tenureDays}
        highlightCountdown={!settlementPosted}
        settled={settlementPosted}
      />
      <TableCell className="whitespace-nowrap">
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
  const invoiceLabel = formatInvoiceReference({
    displayReference: invoice.displayReference,
    businessNumber: invoice.invoiceNumber,
    id: invoice.invoiceId,
  });
  return (
    <TableRow className={adminActionRowClass(true)}>
      <TableCell className="min-w-0 overflow-hidden truncate font-mono text-xs" title={invoiceLabel}>
        {invoiceLabel}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-medium" title={invoiceLabel}>Approved invoice ready for note</div>
        <div className="truncate text-xs text-muted-foreground" title={invoice.issuerName ?? invoice.issuerOrganizationDisplayReference ?? invoice.issuerOrganizationId}>
          {formatNamedEntityDisplay(invoice.issuerName, invoice.issuerOrganizationDisplayReference)}
        </div>
      </TableCell>
      <ProspectusCell />
      <TableCell className="min-w-0 overflow-hidden">
        <SoukscoreRiskRatingBadge riskRating={invoice.riskRating} />
      </TableCell>
      <FacilityCell
        contractId={invoice.contractId}
        displayReference={invoice.contractDisplayReference}
      />
      <TableCell className="min-w-0 overflow-hidden truncate">
        {formatCurrency(invoice.invoiceAmount)}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate text-sm text-muted-foreground">Not listed</div>
        <div className="mt-2 h-2 rounded-full bg-muted" />
        <div className="truncate text-xs text-muted-foreground">
          Profit {invoice.profitRatePercent == null ? "-" : `${invoice.profitRatePercent}%`}
        </div>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <StatusBadge label="Ready" status="action" className="max-w-full truncate" />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">-</span>
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">—</span>
      </TableCell>
      <MaturityCell maturityDate={invoice.maturityDate} invoiceDue />
      <TableCell className="whitespace-nowrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={!canCreate ? "inline-flex cursor-not-allowed" : "inline-flex"}>
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

