"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Card, formatMoneyDisplay, NoteStatusBadge, isNoteFullySettled, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { NoteListItem } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import type {
  IssuerDashboardContract,
  IssuerDashboardInvoice,
} from "@/types/issuer-dashboard";
import {
  getIssuerFinancingStatusPresentation,
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";
import { financingKindToStatusToken } from "@/components/financing/utils";
import {
  countIssuerFinancingActionable,
  isIssuerContractActionable,
  isIssuerInvoiceActionable,
  isIssuerNoteActionable,
} from "@/lib/issuer-financing-actionable";
import { actionsRequiredLabel } from "@/lib/issuer-pending-actions";
import { RecentSectionHeader } from "@/components/dashboard/recent-section-header";

const MAX_ROWS = 4;
const EM = "\u2014";

type Row =
  | { kind: "contract"; data: IssuerDashboardContract; rank: number; updatedAt: number }
  | { kind: "invoice"; data: IssuerDashboardInvoice; rank: number; updatedAt: number }
  | { kind: "note"; data: NoteListItem; rank: number; updatedAt: number };

const STATUS_RANK: Record<IssuerFinancingStatusKind, number> = {
  action_required: 0,
  arrears: 1,
  pending_approval: 2,
  pending_listing: 3,
  in_progress: 4,
  funded: 5,
  active: 6,
  draft: 7,
  completed: 8,
  unsuccessful: 9,
};

function rankContract(c: IssuerDashboardContract): number {
  const base = isIssuerContractActionable(c) ? -10 : 0;
  return base + (STATUS_RANK[resolveIssuerContractDashboardBadge(c.contractStatus)] ?? 99);
}

function rankInvoice(i: IssuerDashboardInvoice): number {
  const base = isIssuerInvoiceActionable(i) ? -10 : 0;
  return base + (STATUS_RANK[resolveIssuerInvoiceDashboardBadge(i.note, i.invoiceStatus)] ?? 99);
}

function formatMoney(v: unknown) {
  return formatMoneyDisplay(v, EM);
}

export function RecentFinancingCard({ organizationId }: { organizationId?: string }) {
  const { data, isLoading: isDashboardLoading } = useIssuerDashboard(organizationId);
  const { data: notesData, isLoading: isNotesLoading } = useIssuerNotes();
  const contracts = data?.contracts ?? [];
  const invoices = data?.invoices ?? [];
  const notes = (notesData?.notes ?? []).filter((n) => !isNoteFullySettled(n));

  const isLoading = isDashboardLoading || isNotesLoading;

  const combined: Row[] = [
    ...contracts.map<Row>((c) => ({
      kind: "contract",
      data: c,
      rank: rankContract(c),
      updatedAt: 0,
    })),
    ...invoices.map<Row>((i) => ({
      kind: "invoice",
      data: i,
      rank: rankInvoice(i),
      updatedAt: i.submissionDate ? new Date(i.submissionDate).getTime() : 0,
    })),
    ...notes.map<Row>((n) => ({
      kind: "note",
      data: n,
      rank: isIssuerNoteActionable(n) ? -10 : 3,
      updatedAt: new Date(n.updatedAt).getTime(),
    })),
  ];

  combined.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.updatedAt - a.updatedAt;
  });
  const visible = combined.slice(0, MAX_ROWS);

  const actionRequiredCount = countIssuerFinancingActionable({
    contracts,
    invoices,
    notes,
  }).total;

  return (
    <Card className={cn("flex h-full flex-col")}>
      <RecentSectionHeader
        title="Recent financing"
        countBadge={
          actionRequiredCount > 0 ? (
            <Badge className="bg-status-action-bg text-status-action-text hover:bg-status-action-bg">
              {actionsRequiredLabel(actionRequiredCount)}
            </Badge>
          ) : null
        }
        viewAllHref="/financing"
      />
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
        {isLoading ? (
          <p className="py-4 text-body leading-7 text-muted-foreground">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-body leading-7 text-muted-foreground">
            No financing activity yet.{" "}
            <Link
              href="/applications/new"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Apply for financing
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {visible.map((row) =>
              row.kind === "contract" ? (
                <ContractRow key={`c-${row.data.id}`} row={row.data} />
              ) : row.kind === "invoice" ? (
                <InvoiceRow key={`i-${row.data.id}`} row={row.data} />
              ) : (
                <NoteRow key={`n-${row.data.id}`} note={row.data} />
              )
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}

function StatusPill({ kind }: { kind: IssuerFinancingStatusKind }) {
  const p = getIssuerFinancingStatusPresentation(kind);
  return <StatusBadge label={p.label} status={financingKindToStatusToken(kind)} className="shrink-0" />;
}

function ContractRow({ row }: { row: IssuerDashboardContract }) {
  const kind = resolveIssuerContractDashboardBadge(row.contractStatus);
  return (
    <li>
      <Link
        href={`/financing/contracts/${row.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-muted-foreground">Facility:</span>
            <span className="truncate text-sm font-semibold text-foreground">
              {row.title?.trim() || EM}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {row.customerName?.trim() || EM} · Approved {formatMoney(row.approvedFacilityAmount)}
          </p>
        </div>
        <StatusPill kind={kind} />
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function InvoiceRow({ row }: { row: IssuerDashboardInvoice }) {
  const kind = resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus);
  const href = `/financing/invoices/${row.id}`;
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-muted-foreground">Invoice:</span>
            <span className="truncate text-sm font-semibold text-foreground">
              {row.invoiceNumber?.trim() || EM}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {row.customerName?.trim() || EM} · {formatMoney(row.financingAmount)}
          </p>
        </div>
        <StatusPill kind={kind} />
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function NoteRow({ note }: { note: NoteListItem }) {
  return (
    <li>
      <Link
        href={`/financing/notes/${note.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-muted-foreground">Note:</span>
            <span className="truncate text-sm font-semibold text-foreground">
              {note.purposeOfFinancing?.trim() || note.title}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            Target {formatCurrency(note.targetAmount)} · Funded {note.fundingPercent.toFixed(1)}%
          </p>
        </div>
        <NoteStatusBadge note={note} className="shrink-0" />
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
