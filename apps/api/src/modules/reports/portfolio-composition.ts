import {
  NoteFundingStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  Prisma,
} from "@prisma/client";
import {
  parseInvoiceOfferCampaignSector,
  SC_CAMPAIGN_SECTOR_LABELS,
  mytCalendarParts,
  type ReportBreakdown,
  type ReportQuery,
  type ReportResult,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { noteOutstandingAmounts, tenureDaysForNote } from "../notes/servicing-classifier";
import {
  isToday,
  issuerName,
  jsonRecord,
  parseAsOf,
  percentOf,
  reportDefinition,
  snapshotName,
  toNumber,
} from "./report-shared";

export const NOT_RECORDED = "Not recorded";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function compositionStartMonth(anchor: Date | null): string {
  if (!anchor) return NOT_RECORDED;
  const parts = mytCalendarParts(anchor);
  return `${MONTH_LABELS[parts.month - 1] ?? "???"} ${parts.year}`;
}

export function compositionPaymasterName(
  paymaster: { legal_name: string } | null | undefined,
  snapshot: Prisma.JsonValue | null
): string {
  const live = paymaster?.legal_name?.trim();
  if (live) return live;
  return snapshotName(snapshot, ["name", "legal_name", "companyName"]) ?? NOT_RECORDED;
}

export function compositionSector(invoiceSnapshot: Prisma.JsonValue | null): string {
  const record = jsonRecord(invoiceSnapshot);
  const offer = record?.offer_details ?? invoiceSnapshot;
  const sector = parseInvoiceOfferCampaignSector(offer);
  if (!sector) return NOT_RECORDED;
  return SC_CAMPAIGN_SECTOR_LABELS[sector];
}

export function compositionGroupLabel(
  breakdown: ReportBreakdown,
  input: {
    startAnchor: Date | null;
    issuerSnapshot: Prisma.JsonValue | null;
    paymaster: { legal_name: string } | null | undefined;
    paymasterSnapshot: Prisma.JsonValue | null;
    invoiceSnapshot: Prisma.JsonValue | null;
  }
): string {
  if (breakdown === "start_month") return compositionStartMonth(input.startAnchor);
  if (breakdown === "issuer") {
    const name = issuerName(input.issuerSnapshot);
    return name === "—" ? NOT_RECORDED : name;
  }
  if (breakdown === "paymaster") {
    return compositionPaymasterName(input.paymaster, input.paymasterSnapshot);
  }
  return compositionSector(input.invoiceSnapshot);
}

type CompositionNote = {
  fundedPrincipal: number;
  outstandingTotal: number;
  daysPastDue: number;
  servicingStatus: string;
  groupLabel: string;
};

export function aggregateCompositionRows(notes: CompositionNote[], totalOutstanding: number) {
  const groups = new Map<
    string,
    {
      noteCount: number;
      fundedPrincipal: number;
      outstandingTotal: number;
      pastDueCount: number;
      pastDueAmount: number;
      defaultedCount: number;
      defaultedAmount: number;
    }
  >();
  for (const note of notes) {
    const current = groups.get(note.groupLabel) ?? {
      noteCount: 0,
      fundedPrincipal: 0,
      outstandingTotal: 0,
      pastDueCount: 0,
      pastDueAmount: 0,
      defaultedCount: 0,
      defaultedAmount: 0,
    };
    current.noteCount += 1;
    current.fundedPrincipal += note.fundedPrincipal;
    current.outstandingTotal += note.outstandingTotal;
    if (note.daysPastDue > 0) {
      current.pastDueCount += 1;
      current.pastDueAmount += note.outstandingTotal;
    }
    if (note.servicingStatus === NoteServicingStatus.DEFAULTED) {
      current.defaultedCount += 1;
      current.defaultedAmount += note.outstandingTotal;
    }
    groups.set(note.groupLabel, current);
  }
  return [...groups.entries()]
    .map(([groupLabel, group]) => ({
      groupLabel,
      noteCount: group.noteCount,
      fundedPrincipal: group.fundedPrincipal,
      outstandingTotal: group.outstandingTotal,
      shareOfBookPercent: percentOf(group.outstandingTotal, totalOutstanding),
      pastDueCount: group.pastDueCount,
      pastDueAmount: group.pastDueAmount,
      defaultedCount: group.defaultedCount,
      defaultedAmount: group.defaultedAmount,
      defaultExposurePercent: percentOf(group.defaultedAmount, group.outstandingTotal),
    }))
    .sort((left, right) => right.outstandingTotal - left.outstandingTotal);
}

function startAnchor(note: {
  activated_at: Date | null;
  disbursement_value_date: Date | null;
  published_at: Date | null;
}): Date | null {
  return note.activated_at ?? note.disbursement_value_date ?? note.published_at;
}

export async function runPortfolioComposition(query: ReportQuery): Promise<ReportResult> {
  const report = reportDefinition("portfolio_composition");
  const breakdown: ReportBreakdown = query.groupBy ?? "start_month";
  const asOf = parseAsOf(query.asOf);
  const asOfLabel = asOf.toISOString().slice(0, 10);

  if (!isToday(query.asOf)) {
    const snapshots = await prisma.notePositionSnapshot.findMany({
      where: { snapshot_date: asOf },
      include: {
        note: {
          select: {
            funded_amount: true,
            issuer_snapshot: true,
            paymaster_snapshot: true,
            invoice_snapshot: true,
            activated_at: true,
            disbursement_value_date: true,
            published_at: true,
            paymaster: { select: { legal_name: true } },
          },
        },
      },
    });
    if (snapshots.length === 0) {
      return {
        key: "portfolio_composition",
        title: report.title,
        asOf: asOfLabel,
        generatedAt: new Date().toISOString(),
        columns: report.columns,
        rows: [],
        summaries: [],
        emptyReason: "No snapshot for this date",
      };
    }
    const notes = snapshots.map((snapshot) => ({
      fundedPrincipal: toNumber(snapshot.note.funded_amount),
      outstandingTotal: toNumber(snapshot.outstanding_total),
      daysPastDue: snapshot.days_past_due,
      servicingStatus: snapshot.servicing_status,
      groupLabel: compositionGroupLabel(breakdown, {
        startAnchor: startAnchor(snapshot.note),
        issuerSnapshot: snapshot.note.issuer_snapshot,
        paymaster: snapshot.note.paymaster,
        paymasterSnapshot: snapshot.note.paymaster_snapshot,
        invoiceSnapshot: snapshot.note.invoice_snapshot,
      }),
    }));
    return finishComposition(report.title, asOfLabel, notes);
  }

  const notes = await prisma.note.findMany({
    where: {
      funding_status: NoteFundingStatus.FUNDED,
      servicing_status: { not: NoteServicingStatus.SETTLED },
    },
    select: {
      funded_amount: true,
      profit_rate_percent: true,
      tenure_days: true,
      disbursement_value_date: true,
      maturity_date: true,
      activated_at: true,
      published_at: true,
      issuer_snapshot: true,
      paymaster_snapshot: true,
      invoice_snapshot: true,
      servicing_status: true,
      days_past_due: true,
      paymaster: { select: { legal_name: true } },
      settlements: {
        where: { status: NoteSettlementStatus.POSTED },
        select: { investor_principal: true, investor_profit_gross: true },
      },
    },
  });
  const mapped = notes.map((note) => {
    const outstanding = noteOutstandingAmounts({
      fundedAmount: toNumber(note.funded_amount),
      recoveredPrincipal: note.settlements.reduce(
        (sum, settlement) => sum + toNumber(settlement.investor_principal),
        0
      ),
      recoveredProfit: note.settlements.reduce(
        (sum, settlement) => sum + toNumber(settlement.investor_profit_gross),
        0
      ),
      profitRatePercent: toNumber(note.profit_rate_percent),
      tenureDays: tenureDaysForNote(note),
    });
    return {
      fundedPrincipal: toNumber(note.funded_amount),
      outstandingTotal: outstanding.outstandingTotal,
      daysPastDue: note.days_past_due,
      servicingStatus: note.servicing_status,
      groupLabel: compositionGroupLabel(breakdown, {
        startAnchor: startAnchor(note),
        issuerSnapshot: note.issuer_snapshot,
        paymaster: note.paymaster,
        paymasterSnapshot: note.paymaster_snapshot,
        invoiceSnapshot: note.invoice_snapshot,
      }),
    };
  });
  return finishComposition(report.title, asOfLabel, mapped);
}

function finishComposition(
  title: string,
  asOfLabel: string,
  notes: CompositionNote[]
): ReportResult {
  const totalOutstanding = notes.reduce((sum, note) => sum + note.outstandingTotal, 0);
  const rows = aggregateCompositionRows(notes, totalOutstanding);
  return {
    key: "portfolio_composition",
    title,
    asOf: asOfLabel,
    generatedAt: new Date().toISOString(),
    columns: reportDefinition("portfolio_composition").columns,
    rows,
    summaries: [
      { label: "Notes", count: notes.length },
      { label: "Outstanding", amount: totalOutstanding },
      { label: "Groups", count: rows.length },
    ],
  };
}
