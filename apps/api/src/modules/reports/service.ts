import {
  DpdBucket,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  Prisma,
} from "@prisma/client";
import {
  REPORT_REGISTRY,
  type ReportKey,
  type ReportQuery,
  type ReportResult,
  type ReportSummaryRow,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import {
  calendarDateInTimeZone,
  calendarDaysBetween,
  noteOutstandingAmounts,
  tenureDaysForNote,
} from "../notes/servicing-classifier";
import { runInvestorBook } from "./investor-book";
import { runOrigination } from "./origination";
import { summarizePortfolioAtRisk } from "./par-summary";
import { runPortfolioComposition } from "./portfolio-composition";
import {
  assertReportQuery,
  defaultedNoteWhere,
  exclusiveEndOfMytDateLabel,
  liveOpenBookNoteWhere,
  mergeDefaultRecoverySnapshots,
  openBookSnapshots,
  postedAtRange,
} from "./report-shared";
import {
  lateFeeExcessPaymentRow,
  lateFeeSettlementAppliedRow,
  lateFeeWaiverMovementRow,
} from "./late-fees-report";
import { runTrustRevenue } from "./trust-revenue";

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function issuerName(snapshot: Prisma.JsonValue | null): string {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "—";
  const record = snapshot as Record<string, unknown>;
  const name = record.companyName ?? record.legal_name ?? record.name;
  return typeof name === "string" && name.trim() ? name : "—";
}

function isToday(asOf?: string): boolean {
  if (!asOf) return true;
  return asOf === calendarDateInTimeZone(new Date()).toISOString().slice(0, 10);
}

function parseAsOf(asOf?: string): Date {
  const iso = asOf ?? calendarDateInTimeZone(new Date()).toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function definition(key: ReportKey) {
  const report = REPORT_REGISTRY.find((item) => item.key === key);
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "Report not found");
  return report;
}

function recoveredFromSettlements(
  settlements: Array<{
    investor_principal: Prisma.Decimal | number | string | null;
    investor_profit_gross: Prisma.Decimal | number | string | null;
  }>
): number {
  return settlements.reduce(
    (sum, settlement) =>
      sum + toNumber(settlement.investor_principal) + toNumber(settlement.investor_profit_gross),
    0
  );
}

function tenureDaysForProfit(note: {
  tenure_days: number | null;
  disbursement_value_date: Date | null;
  activated_at: Date | null;
  maturity_date: Date | null;
}): number {
  return tenureDaysForNote(note);
}


export function listReportCatalog() {
  return { reports: REPORT_REGISTRY };
}

export async function runReport(key: ReportKey, query: ReportQuery): Promise<ReportResult> {
  assertReportQuery(key, query);
  const report = definition(key);
  if (!report.available) {
    return {
      key,
      title: report.title,
      generatedAt: new Date().toISOString(),
      columns: report.columns,
      rows: [],
      summaries: [],
      emptyReason: "Not available yet",
    };
  }
  switch (key) {
    case "ageing":
      return runAgeing(query);
    case "npl":
      return runNpl(query);
    case "late_fees":
      return runLateFees(query);
    case "default_recovery":
      return runDefaultRecovery(query);
    case "origination":
      return runOrigination(query);
    case "portfolio_composition":
      return runPortfolioComposition(query);
    case "investor_book":
      return runInvestorBook(query);
    case "trust_revenue":
      return runTrustRevenue(query);
    case "comrep":
      return {
        key,
        title: report.title,
        generatedAt: new Date().toISOString(),
        columns: report.columns,
        rows: [],
        summaries: [],
        emptyReason: "Not available yet",
      };
    default: {
      const exhaustive: never = key;
      throw new AppError(404, "REPORT_NOT_FOUND", `Unsupported report ${exhaustive}`);
    }
  }
}

async function runAgeing(query: ReportQuery): Promise<ReportResult> {
  const report = definition("ageing");
  const asOf = parseAsOf(query.asOf);
  const asOfLabel = asOf.toISOString().slice(0, 10);
  if (!isToday(query.asOf)) {
    const snapshots = await prisma.notePositionSnapshot.findMany({
      where: { snapshot_date: asOf },
      include: { note: { select: { id: true, note_reference: true, issuer_snapshot: true } } },
    });
    if (snapshots.length === 0) {
      return {
        key: "ageing",
        title: report.title,
        asOf: asOfLabel,
        generatedAt: new Date().toISOString(),
        columns: report.columns,
        rows: [],
        summaries: [],
        portfolioAtRisk: summarizePortfolioAtRisk([], asOfLabel),
        emptyReason: "No snapshot for this date",
      };
    }
    const rows = openBookSnapshots(snapshots).map((snapshot) => ({
      noteId: snapshot.note.id,
      noteReference: snapshot.note.note_reference,
      issuerName: issuerName(snapshot.note.issuer_snapshot),
      servicingStatus: snapshot.servicing_status,
      daysPastDue: snapshot.days_past_due,
      dpdBucket: snapshot.dpd_bucket,
      outstandingPrincipal: toNumber(snapshot.outstanding_principal),
      outstandingProfit: toNumber(snapshot.outstanding_profit),
      indicativeTawidh: toNumber(snapshot.indicative_tawidh),
      indicativeGharamah: toNumber(snapshot.indicative_gharamah),
      recoveredTotal:
        toNumber(snapshot.recovered_principal) + toNumber(snapshot.recovered_profit),
    }));
    const portfolioAtRisk = summarizePortfolioAtRisk(rows, asOfLabel);
    return {
      key: "ageing",
      title: report.title,
      asOf: asOfLabel,
      generatedAt: new Date().toISOString(),
      columns: report.columns,
      rows,
      summaries: [],
      portfolioAtRisk,
    };
  }

  const notes = await prisma.note.findMany({
    where: liveOpenBookNoteWhere(),
    select: {
      id: true,
      note_reference: true,
      issuer_snapshot: true,
      servicing_status: true,
      days_past_due: true,
      funded_amount: true,
      profit_rate_percent: true,
      tenure_days: true,
      disbursement_value_date: true,
      maturity_date: true,
      indicative_tawidh_amount: true,
      indicative_gharamah_amount: true,
      activated_at: true,
      settlements: {
        where: { status: NoteSettlementStatus.POSTED },
        select: { investor_principal: true, investor_profit_gross: true },
      },
    },
  });
  const rows = notes.map((note) => {
    const dpd = note.days_past_due;
    const dpdBucket =
      dpd <= 0
        ? DpdBucket.CURRENT
        : dpd <= 30
          ? DpdBucket.DPD_1_30
          : dpd <= 60
            ? DpdBucket.DPD_31_60
            : dpd <= 90
              ? DpdBucket.DPD_61_90
              : DpdBucket.DPD_90_PLUS;
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
      tenureDays: tenureDaysForProfit(note),
    });
    return {
      noteId: note.id,
      noteReference: note.note_reference,
      issuerName: issuerName(note.issuer_snapshot),
      servicingStatus: note.servicing_status,
      daysPastDue: dpd,
      dpdBucket,
      outstandingPrincipal: outstanding.outstandingPrincipal,
      outstandingProfit: outstanding.outstandingProfit,
      indicativeTawidh: toNumber(note.indicative_tawidh_amount),
      indicativeGharamah: toNumber(note.indicative_gharamah_amount),
      recoveredTotal: recoveredFromSettlements(note.settlements),
    };
  });
  const portfolioAtRisk = summarizePortfolioAtRisk(rows, asOfLabel);
  return {
    key: "ageing",
    title: report.title,
    asOf: asOfLabel,
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows,
    summaries: [],
    portfolioAtRisk,
  };
}

async function runNpl(query: ReportQuery): Promise<ReportResult> {
  const ageing = await runAgeing(query);
  const report = definition("npl");
  const rows = ageing.rows.map((row) => {
    const servicingStatus = String(row.servicingStatus);
    const daysPastDue = Number(row.daysPastDue ?? 0);
    const outstandingTotal =
      Number(row.outstandingPrincipal ?? 0) + Number(row.outstandingProfit ?? 0);
    return {
      noteId: row.noteId,
      noteReference: row.noteReference,
      issuerName: row.issuerName,
      servicingStatus,
      isInternalNpl:
        servicingStatus === NoteServicingStatus.ARREARS ||
        servicingStatus === NoteServicingStatus.DEFAULTED,
      isScDefault: daysPastDue > 90,
      daysPastDue,
      outstandingTotal,
      recoveredTotal: Number(row.recoveredTotal ?? 0),
    };
  });
  const book = rows.reduce((sum, row) => sum + Number(row.outstandingTotal), 0);
  const internal = rows.filter((row) => row.isInternalNpl);
  const sc = rows.filter((row) => row.isScDefault);
  return {
    key: "npl",
    title: report.title,
    asOf: ageing.asOf,
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows,
    emptyReason: ageing.emptyReason,
    portfolioAtRisk: ageing.portfolioAtRisk,
    summaries: [
      {
        label: "Internal NPL",
        count: internal.length,
        amount: internal.reduce((sum, row) => sum + Number(row.outstandingTotal), 0),
        percent: book > 0 ? (internal.reduce((sum, row) => sum + Number(row.outstandingTotal), 0) / book) * 100 : 0,
      },
      {
        label: "SC >90 DPD",
        count: sc.length,
        amount: sc.reduce((sum, row) => sum + Number(row.outstandingTotal), 0),
        percent: book > 0 ? (sc.reduce((sum, row) => sum + Number(row.outstandingTotal), 0) / book) * 100 : 0,
      },
    ],
  };
}

async function runLateFees(query: ReportQuery): Promise<ReportResult> {
  const report = definition("late_fees");
  const range = postedAtRange(query);
  const movementRange = range
    ? {
        OR: [
          { settled_at: { gte: range.gte, lt: range.lt } },
          { settled_at: null, updated_at: { gte: range.gte, lt: range.lt } },
        ],
      }
    : {};
  const [settlements, waivers, excessPayments] = await Promise.all([
    prisma.noteSettlement.findMany({
      where: {
        status: NoteSettlementStatus.POSTED,
        ...(range ? { posted_at: { gte: range.gte, lt: range.lt } } : {}),
      },
      include: { note: { select: { id: true, note_reference: true } } },
      orderBy: { posted_at: "desc" },
    }),
    prisma.noteLateChargeWaiver.findMany({
      where: range ? { created_at: { gte: range.gte, lt: range.lt } } : {},
      include: { note: { select: { id: true, note_reference: true } } },
      orderBy: { created_at: "desc" },
    }),
    prisma.gatewayPayment.findMany({
      where: {
        purpose: GatewayPaymentPurpose.EXCESS_LATE_CHARGES,
        status: GatewayPaymentStatus.COMPLETED,
        ...movementRange,
      },
      include: { note: { select: { id: true, note_reference: true } } },
      orderBy: { updated_at: "desc" },
    }),
  ]);
  const rows = settlements.map((settlement) =>
    lateFeeSettlementAppliedRow({
      noteId: settlement.note.id,
      noteReference: settlement.note.note_reference,
      settlementReference: settlement.display_reference ?? "Settlement",
      postedAt: settlement.posted_at?.toISOString() ?? null,
      tawidhApplied: toNumber(settlement.tawidh_amount),
      gharamahApplied: toNumber(settlement.gharamah_amount),
      tawidhInvestor: toNumber(settlement.tawidh_investor_amount),
      tawidhPlatform: toNumber(settlement.tawidh_account_amount),
      excessLateChargeAmount: toNumber(settlement.excess_late_charge_amount),
    })
  );
  const waiverRows = waivers.map((waiver) =>
    lateFeeWaiverMovementRow({
      noteId: waiver.note.id,
      noteReference: waiver.note.note_reference,
      createdAt: waiver.created_at.toISOString(),
      waivedTotal: toNumber(waiver.tawidh_waived_amount) + toNumber(waiver.gharamah_waived_amount),
    })
  );
  const paymentRows = excessPayments.flatMap((payment) => {
    if (!payment.note) return [];
    return [
      lateFeeExcessPaymentRow({
        noteId: payment.note.id,
        noteReference: payment.note.note_reference,
        completedAt: (payment.settled_at ?? payment.updated_at).toISOString(),
        excessPaid: toNumber(payment.amount),
      }),
    ];
  });
  const combined = [...rows, ...waiverRows, ...paymentRows];
  const tawidh = combined.reduce((sum, row) => sum + Number(row.tawidhApplied), 0);
  const gharamah = combined.reduce((sum, row) => sum + Number(row.gharamahApplied), 0);
  const waived = combined.reduce((sum, row) => sum + Number(row.waivedTotal), 0);
  return {
    key: "late_fees",
    title: report.title,
    from: query.from ?? null,
    to: query.to ?? null,
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows: combined,
    summaries: [
      { label: "Ta'widh applied", amount: tawidh },
      { label: "Gharamah applied", amount: gharamah },
      { label: "Waived", amount: waived },
    ],
  };
}

async function runDefaultRecovery(query: ReportQuery): Promise<ReportResult> {
  const report = definition("default_recovery");
  const asOf = parseAsOf(query.asOf);
  const asOfLabel = asOf.toISOString().slice(0, 10);
  const asOfExclusiveEnd = exclusiveEndOfMytDateLabel(asOfLabel);
  if (!isToday(query.asOf)) {
    const snapshotInclude = {
      note: {
        select: {
          id: true,
          note_reference: true,
          issuer_snapshot: true,
          default_marked_at: true,
          default_reason: true,
          funded_amount: true,
        },
      },
    } satisfies Prisma.NotePositionSnapshotInclude;
    const [exactDateSnapshots, settledSnapshots, snapshotCount] = await Promise.all([
      prisma.notePositionSnapshot.findMany({
        where: { snapshot_date: asOf, note: defaultedNoteWhere(asOfExclusiveEnd) },
        include: snapshotInclude,
      }),
      prisma.notePositionSnapshot.findMany({
        where: {
          snapshot_date: { lte: asOf },
          servicing_status: NoteServicingStatus.SETTLED,
          note: defaultedNoteWhere(asOfExclusiveEnd),
        },
        include: snapshotInclude,
      }),
      prisma.notePositionSnapshot.count({
        where: { snapshot_date: asOf },
      }),
    ]);
    if (snapshotCount === 0) {
      return {
        key: "default_recovery",
        title: report.title,
        asOf: asOfLabel,
        generatedAt: new Date().toISOString(),
        columns: report.columns,
        rows: [],
        summaries: [{ label: "Defaulted notes", count: 0, amount: 0 }],
        emptyReason: "No snapshot for this date",
      };
    }
    const snapshots = mergeDefaultRecoverySnapshots(exactDateSnapshots, settledSnapshots);
    const rows = snapshots.map((snapshot) => {
      const funded = toNumber(snapshot.note.funded_amount);
      const recoveredPrincipal = toNumber(snapshot.recovered_principal);
      const recoveredProfit = toNumber(snapshot.recovered_profit);
      const daysSinceDefault = snapshot.note.default_marked_at
        ? calendarDaysBetween(snapshot.note.default_marked_at, asOf)
        : 0;
      return {
        noteId: snapshot.note.id,
        noteReference: snapshot.note.note_reference,
        issuerName: issuerName(snapshot.note.issuer_snapshot),
        servicingStatus: snapshot.servicing_status,
        defaultDate: snapshot.note.default_marked_at?.toISOString() ?? null,
        defaultReason: snapshot.note.default_reason,
        fundedPrincipal: funded,
        recoveredPrincipal,
        recoveredProfit,
        outstandingTotal: toNumber(snapshot.outstanding_total),
        recoveryPercent: funded > 0 ? (recoveredPrincipal / funded) * 100 : 0,
        daysSinceDefault,
      };
    });
    return {
      key: "default_recovery",
      title: report.title,
      asOf: asOfLabel,
      generatedAt: new Date().toISOString(),
      columns: report.columns,
      rows,
      summaries: [
        {
          label: "Defaulted notes",
          count: rows.length,
          amount: rows.reduce((sum, row) => sum + Number(row.outstandingTotal), 0),
        },
      ],
    };
  }

  const notes = await prisma.note.findMany({
    where: defaultedNoteWhere(),
    include: {
      settlements: {
        where: { status: NoteSettlementStatus.POSTED },
        select: {
          investor_principal: true,
          investor_profit_gross: true,
          tawidh_amount: true,
          gharamah_amount: true,
          posted_at: true,
        },
      },
    },
  });
  const rows = notes.map((note) => {
    const recoveredPrincipal = note.settlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.investor_principal),
      0
    );
    const recoveredProfit = note.settlements.reduce(
      (sum, settlement) => sum + toNumber(settlement.investor_profit_gross),
      0
    );
    const funded = toNumber(note.funded_amount);
    const lastReceipt = note.settlements
      .map((settlement) => settlement.posted_at)
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => right.getTime() - left.getTime())[0];
    const daysSinceDefault = note.default_marked_at
      ? calendarDaysBetween(note.default_marked_at, asOf)
      : 0;
    const outstanding = noteOutstandingAmounts({
      fundedAmount: funded,
      recoveredPrincipal,
      recoveredProfit,
      profitRatePercent: toNumber(note.profit_rate_percent),
      tenureDays: tenureDaysForProfit(note),
    });
    return {
      noteId: note.id,
      noteReference: note.note_reference,
      issuerName: issuerName(note.issuer_snapshot),
      servicingStatus: note.servicing_status,
      defaultDate: note.default_marked_at?.toISOString() ?? null,
      defaultReason: note.default_reason,
      fundedPrincipal: funded,
      recoveredPrincipal,
      recoveredProfit,
      outstandingTotal: outstanding.outstandingTotal,
      recoveryPercent: funded > 0 ? (recoveredPrincipal / funded) * 100 : 0,
      daysSinceDefault,
      lastReceipt: lastReceipt?.toISOString() ?? null,
    };
  });
  return {
    key: "default_recovery",
    title: report.title,
    asOf: asOf.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows,
    summaries: [
      {
        label: "Defaulted notes",
        count: rows.length,
        amount: rows.reduce((sum, row) => sum + Number(row.outstandingTotal), 0),
      },
    ],
  };
}
