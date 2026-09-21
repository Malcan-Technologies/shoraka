import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  NoteStatusBadge,
  FundingProgress,
  SoukscoreRiskRatingBadge,
  STATUS_BADGE_COMPACT_CLASS,
  StatusBadge,
  getNoteDerivedStatusToken,
} from "@cashsouk/ui";
import {
  formatInvoiceReference,
  formatNamedEntityDisplay,
  formatNoteFundingPercent,
  formatProspectusListBadge,
  isNoteSettlementPosted,
  resolveNoteTimingDisplay,
  resolveSettlementTrusteeRegistryState,
  settlementTrusteeRegistryLabel,
  settlementTrusteeRegistryNeedsAdminAction,
  type EligibleNoteInvoice,
  type NoteListItem,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  getNoteFundingIndicatorClass,
  getNoteFundingProgressClass,
  noteDisplayFundingPercent,
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

/** Overrides SoukscoreRiskRatingBadge truncate so SME-10 padding is not clipped. */
const NOTES_TABLE_RISK_BADGE_CLASS = cn(
  STATUS_BADGE_COMPACT_CLASS,
  "max-w-none shrink-0 overflow-visible text-clip"
);

/** Overrides NoteStatusBadge truncate so long labels stay fully visible. */
const NOTES_TABLE_STATUS_BADGE_CLASS = "max-w-none shrink-0 overflow-visible whitespace-nowrap";

const NOTES_TABLE_ACTIONS_CELL_CLASS =
  "overflow-visible whitespace-nowrap text-center last:pr-2";

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

function TrusteeCell({ note }: { note: NoteListItem }) {
  const state = resolveSettlementTrusteeRegistryState(note.settlementSummary);
  const trusteeLabel = settlementTrusteeRegistryLabel(state);
  if (trusteeLabel) {
    const status =
      state === "complete" ? "success" : state === "submitted" ? "submitted" : "action";
    return (
      <StatusBadge label={trusteeLabel} status={status} size="sm" title={trusteeLabel} />
    );
  }
  if (isNoteSettlementPosted(note)) {
    return <StatusBadge label="Settled" status="success" size="sm" />;
  }
  return <span className="text-muted-foreground">—</span>;
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

function ProspectusCheck({ note }: { note: NoteListItem }) {
  if (!hasProspectusIndicator(note) || !note.prospectus) return null;
  const label = formatProspectusListBadge(note.prospectus.displayStatus);
  return (
    <CheckIcon
      className="size-4 shrink-0 text-status-success-text"
      title={label}
      aria-label={label}
    />
  );
}

function FacilityInline({
  contractId,
  displayReference,
}: {
  contractId: string | null;
  displayReference?: string | null;
}) {
  const facility = resolveNoteFacilityLink({ contractId, displayReference });
  if (!facility) return null;
  return (
    <>
      <span className="shrink-0">·</span>
      <Link
        href={facility.href}
        title={facility.label}
        className="truncate font-mono font-medium text-primary underline-offset-4 hover:underline"
      >
        {facility.label}
      </Link>
    </>
  );
}

function NoteIdentityCell({ note }: { note: NoteListItem }) {
  const issuer = note.issuerName ?? "Unknown issuer";
  return (
    <TableCell className="min-w-0 overflow-hidden">
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 truncate font-mono text-xs" title={note.noteReference}>
          {note.noteReference}
        </div>
        {note.isFeatured ? (
          <StatusBadge label="Featured" status="active" size="sm" showDot={false} />
        ) : null}
      </div>
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="min-w-0 truncate font-medium" title={note.title}>
          {note.title}
        </div>
        <ProspectusCheck note={note} />
      </div>
      <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate" title={issuer}>
          {issuer}
        </span>
        <FacilityInline
          contractId={note.sourceContractId}
          displayReference={note.sourceContractDisplayReference}
        />
      </div>
    </TableCell>
  );
}

function RiskCell({ riskRating }: { riskRating: string | null | undefined }) {
  return (
    <TableCell className="min-w-[6rem]">
      <SoukscoreRiskRatingBadge riskRating={riskRating} className={NOTES_TABLE_RISK_BADGE_CLASS} />
    </TableCell>
  );
}

function NoteRow({ note, onViewDetails }: NoteRowProps) {
  const fundingPercent = noteDisplayFundingPercent(note);
  const fundingProgress = Math.min(Math.max(fundingPercent, 0), 100);
  const settlementPosted = isNoteSettlementPosted(note);
  const daysPastDue = note.daysPastDue && note.daysPastDue > 0 ? note.daysPastDue : null;
  return (
    <TableRow className={noteRowHighlightClass(note)}>
      <NoteIdentityCell note={note} />
      <RiskCell riskRating={note.riskRating} />
      <TableCell className="min-w-0 overflow-hidden truncate">
        {formatCurrency(note.settlementAmount)}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="font-medium tabular-nums">{formatNoteFundingPercent(fundingPercent)} funded</div>
        <FundingProgress
          className="mt-1.5"
          percent={fundingProgress}
          thresholdPercent={0}
          fillClassName={getNoteFundingIndicatorClass(note)}
          trackClassName={getNoteFundingProgressClass(note)}
          aria-label={`${formatNoteFundingPercent(fundingPercent)} funded. ${note.minimumFundingPercent}% minimum required for funding to succeed.`}
        />
      </TableCell>
      <TableCell className="min-w-[13rem] overflow-visible">
        <NoteStatusBadge note={note} marker="dot" className={NOTES_TABLE_STATUS_BADGE_CLASS} />
        {daysPastDue ? (
          <div className="mt-0.5 tabular-nums text-xs text-muted-foreground">{daysPastDue} DPD</div>
        ) : null}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <TrusteeCell note={note} />
      </TableCell>
      <MaturityCell
        maturityDate={note.maturityDate}
        tenureDays={note.tenureDays}
        highlightCountdown={!settlementPosted}
        settled={settlementPosted}
      />
      <TableCell className={NOTES_TABLE_ACTIONS_CELL_CLASS}>
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
  const issuer = formatNamedEntityDisplay(
    invoice.issuerName,
    invoice.issuerOrganizationDisplayReference
  );
  return (
    <TableRow className={adminActionRowClass(true)}>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate font-mono text-xs" title={invoiceLabel}>
          {invoiceLabel}
        </div>
        <div className="truncate font-medium" title="Approved invoice ready for note">
          Approved invoice ready for note
        </div>
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span
            className="truncate"
            title={
              invoice.issuerName ??
              invoice.issuerOrganizationDisplayReference ??
              invoice.issuerOrganizationId
            }
          >
            {issuer}
          </span>
          <FacilityInline
            contractId={invoice.contractId}
            displayReference={invoice.contractDisplayReference}
          />
        </div>
      </TableCell>
      <RiskCell riskRating={invoice.riskRating} />
      <TableCell className="min-w-0 overflow-hidden truncate">
        {formatCurrency(invoice.invoiceAmount)}
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <div className="truncate text-sm text-muted-foreground">Not listed</div>
        <div className="mt-1.5 h-2 rounded-full bg-muted" />
      </TableCell>
      <TableCell className="min-w-[13rem] overflow-visible">
        <StatusBadge label="Ready" status="action" size="sm" className="max-w-none whitespace-nowrap" />
      </TableCell>
      <TableCell className="min-w-0 overflow-hidden">
        <span className="text-muted-foreground">—</span>
      </TableCell>
      <MaturityCell maturityDate={invoice.maturityDate} invoiceDue />
      <TableCell className={NOTES_TABLE_ACTIONS_CELL_CLASS}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={!canCreate ? "inline-flex cursor-not-allowed" : "inline-flex"}>
                <Button
                  size="sm"
                  className="h-8 px-2.5"
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
