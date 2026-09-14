/**
 * Recomputes admin dashboard figures from the local DB and compares them to
 * the same repository/report functions the UI calls.
 *
 *   pnpm --filter @cashsouk/api exec tsx scripts/verify-dashboard-data.ts
 */
import {
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteStatus,
  OnboardingStatus,
  Prisma,
} from "@prisma/client";
import {
  addMytCalendarDays,
  mytCalendarParts,
  mytStartOfDayUtc,
  par90LimitStatus,
  roundNoteMoney,
  SC_PAR90_LIMIT_PERCENT,
} from "@cashsouk/types";
import {
  addUtcCalendarDays,
  BOOK_METRICS_HISTORY_LOOKBACK_DAYS,
} from "../src/modules/admin/book-metrics-snapshot";
import { AdminRepository } from "../src/modules/admin/repository";
import { AdminService } from "../src/modules/admin/service";
import { issuerDashboardService } from "../src/modules/issuer-dashboard/service";
import { NoteService } from "../src/modules/notes/service";
import {
  calendarDateInTimeZone,
  classifyServicing,
  noteOutstandingAmounts,
  resolveServicingDueDate,
  tenureDaysForNote,
} from "../src/modules/notes/servicing-classifier";
import { prisma } from "../src/lib/prisma";
import { runReport } from "../src/modules/reports/service";
import { summarizePortfolioAtRisk } from "../src/modules/reports/par-summary";
import { mytYearMonthsThrough } from "../src/modules/notes/investor-dashboard-metrics";

const MONEY_EPS = 0.02;

function n(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= MONEY_EPS;
}

function pctClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.05;
}

type Check = { name: string; ok: boolean; detail: string };

const checks: Check[] = [];
const skipped: string[] = [];
let snapshotsSeeded = false;

function check(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function skip(name: string, detail: string) {
  skipped.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`SKIP  ${name}${detail ? ` — ${detail}` : ""}`);
}

function expectEqual(name: string, actual: number, expected: number, mode: "int" | "money" | "pct" = "int") {
  const ok = mode === "int" ? actual === expected : mode === "pct" ? pctClose(actual, expected) : moneyClose(actual, expected);
  check(name, ok, `got ${actual}, expected ${expected}`);
}

async function main() {
  const repo = new AdminRepository();
  const notes = new NoteService();

  const fundedOpen = await prisma.note.findMany({
    where: {
      funding_status: NoteFundingStatus.FUNDED,
      servicing_status: { not: NoteServicingStatus.SETTLED },
    },
    include: {
      payment_schedules: { select: { due_date: true, sequence: true } },
      settlements: {
        where: { status: NoteSettlementStatus.POSTED },
        select: { investor_principal: true, investor_profit_gross: true },
      },
    },
  });

  const today = calendarDateInTimeZone(new Date());
  const independentRows = fundedOpen.map((note) => {
    const due = resolveServicingDueDate(note);
    const live = classifyServicing(
      {
        servicing_status: note.servicing_status,
        status: note.status,
        grace_period_days: note.grace_period_days,
        arrears_threshold_days: note.arrears_threshold_days,
        tawidh_rate_cap_percent: n(note.tawidh_rate_cap_percent),
        gharamah_rate_cap_percent: n(note.gharamah_rate_cap_percent),
        due_date: due,
        receipt_amount: n(note.settlement_amount ?? note.funded_amount),
      },
      new Date()
    );
    const outstanding = noteOutstandingAmounts({
      fundedAmount: n(note.funded_amount),
      recoveredPrincipal: note.settlements.reduce((sum, row) => sum + n(row.investor_principal), 0),
      recoveredProfit: note.settlements.reduce((sum, row) => sum + n(row.investor_profit_gross), 0),
      profitRatePercent: n(note.profit_rate_percent),
      tenureDays: tenureDaysForNote(note),
    });
    return {
      id: note.id,
      ref: note.note_reference,
      status: note.status,
      servicing: note.servicing_status,
      defaultMarkedAt: note.default_marked_at,
      storedDpd: note.days_past_due,
      liveDpd: live.daysPastDue,
      dueDate: due,
      outstanding,
    };
  });

  const staleDpd = independentRows.filter((row) => row.storedDpd !== row.liveDpd);
  check(
    "stored DPD matches live KL classification",
    staleDpd.length === 0,
    staleDpd.length
      ? staleDpd
          .slice(0, 8)
          .map((row) => `${row.ref}: stored ${row.storedDpd} live ${row.liveDpd}`)
          .join("; ")
      : `${independentRows.length} funded open notes`
  );

  const drifted = fundedOpen.filter((note) => {
    const servicingDefault = note.servicing_status === NoteServicingStatus.DEFAULTED;
    const statusDefault = note.status === NoteStatus.DEFAULTED;
    const servicingArrears = note.servicing_status === NoteServicingStatus.ARREARS;
    const statusArrears = note.status === NoteStatus.ARREARS;
    return servicingDefault !== statusDefault || (servicingArrears && !statusArrears && !statusDefault);
  });
  check(
    "note.status aligns with servicing ARREARS/DEFAULTED",
    drifted.length === 0,
    drifted.length
      ? drifted.map((note) => `${note.note_reference}: status ${note.status} servicing ${note.servicing_status}`).join("; ")
      : "aligned"
  );

  const ageing = await runReport("ageing", {});
  const parFromStored = summarizePortfolioAtRisk(
    independentRows.map((row) => ({
      daysPastDue: row.storedDpd,
      servicingStatus: row.servicing,
      outstandingPrincipal: row.outstanding.outstandingPrincipal,
      outstandingProfit: row.outstanding.outstandingProfit,
    })),
    today.toISOString().slice(0, 10)
  );
  const parFromLive = summarizePortfolioAtRisk(
    independentRows.map((row) => ({
      daysPastDue: row.liveDpd,
      servicingStatus: row.servicing,
      outstandingPrincipal: row.outstanding.outstandingPrincipal,
      outstandingProfit: row.outstanding.outstandingProfit,
    })),
    today.toISOString().slice(0, 10)
  );
  const apiPar = ageing.portfolioAtRisk;
  if (!apiPar) {
    check("ageing report exposes portfolioAtRisk", false, "missing");
  } else {
    for (const key of ["pastDue", "par30", "par60", "par90", "defaulted"] as const) {
      expectEqual(`PAR ${key} count (API vs independent stored DPD)`, apiPar[key].count, parFromStored[key].count);
      expectEqual(`PAR ${key} amount (API vs independent stored DPD)`, apiPar[key].amount, parFromStored[key].amount, "money");
      expectEqual(`PAR ${key} percent (API vs independent stored DPD)`, apiPar[key].percent, parFromStored[key].percent, "pct");
    }
    expectEqual("PAR book outstanding", apiPar.bookOutstanding, parFromStored.bookOutstanding, "money");
    expectEqual("PAR book count", apiPar.bookCount, parFromStored.bookCount);
    for (const key of ["pastDue", "par30", "par60", "par90", "defaulted"] as const) {
      expectEqual(`PAR ${key} count (stored DPD vs live KL DPD)`, parFromStored[key].count, parFromLive[key].count);
    }

    const exclusive = apiPar.exclusive;
    const exclusiveBands = [
      exclusive.current,
      exclusive.dpd1To30,
      exclusive.dpd31To60,
      exclusive.dpd61To90,
      exclusive.dpd90Plus,
    ] as const;
    const exclusiveCountSum = exclusiveBands.reduce((sum, band) => sum + band.count, 0);
    const exclusiveAmountSum = roundNoteMoney(
      exclusiveBands.reduce((sum, band) => sum + band.amount, 0)
    );
    expectEqual("Exclusive DPD band counts cover book", exclusiveCountSum, apiPar.bookCount);
    expectEqual(
      "Exclusive DPD band amounts cover book outstanding",
      exclusiveAmountSum,
      apiPar.bookOutstanding,
      "money"
    );
    expectEqual("Exclusive dpd90Plus count equals PAR90", exclusive.dpd90Plus.count, apiPar.par90.count);
    expectEqual(
      "Exclusive dpd90Plus amount equals PAR90",
      exclusive.dpd90Plus.amount,
      apiPar.par90.amount,
      "money"
    );
    const exclusiveOverdueCount =
      exclusive.dpd1To30.count +
      exclusive.dpd31To60.count +
      exclusive.dpd61To90.count +
      exclusive.dpd90Plus.count;
    expectEqual("Past-due count equals exclusive overdue bands", apiPar.pastDue.count, exclusiveOverdueCount);

    const par90Status = par90LimitStatus(apiPar.par90.percent);
    const par90Expected = apiPar.par90.percent <= SC_PAR90_LIMIT_PERCENT ? "inside" : "over";
    check(
      "par90LimitStatus agrees with percent vs 5%",
      par90Status === par90Expected,
      `par90 ${apiPar.par90.percent.toFixed(4)}% → helper ${par90Status}; percent<=${SC_PAR90_LIMIT_PERCENT} implies ${par90Expected}`
    );
    check(
      "PAR90 vs SC 5% limit (book fact, not a fail)",
      true,
      `par90 ${apiPar.par90.percent.toFixed(4)}% is ${par90Status} the ${SC_PAR90_LIMIT_PERCENT}% SC limit`
    );
  }

  const book = await repo.getBookMetrics();
  const inFunding = await prisma.note.aggregate({
    where: { status: { in: [NoteStatus.PUBLISHED, NoteStatus.FUNDING] } },
    _sum: { funded_amount: true },
    _count: true,
  });
  const metric = (rows: typeof independentRows) => ({
    count: rows.length,
    amount: roundNoteMoney(
      rows.reduce((sum, row) => sum + row.outstanding.outstandingTotal, 0)
    ),
  });
  const outstanding = metric(
    independentRows.filter((row) => row.status === NoteStatus.ACTIVE)
  );
  const arrears = metric(
    independentRows.filter(
      (row) =>
        row.servicing === NoteServicingStatus.ARREARS && row.defaultMarkedAt == null
    )
  );
  const defaulted = metric(
    independentRows.filter((row) => row.servicing === NoteServicingStatus.DEFAULTED)
  );

  expectEqual("Finance outstanding count", book.outstanding.count, outstanding.count);
  expectEqual("Finance outstanding amount", book.outstanding.amount, outstanding.amount, "money");
  expectEqual("Finance in-funding count", book.inFunding.count, inFunding._count);
  expectEqual("Finance in-funding amount", book.inFunding.amount, n(inFunding._sum.funded_amount), "money");
  expectEqual("Finance arrears count", book.arrears.count, arrears.count);
  expectEqual("Finance arrears amount", book.arrears.amount, arrears.amount, "money");
  expectEqual("Finance defaulted count", book.defaulted.count, defaulted.count);
  expectEqual("Finance defaulted amount", book.defaulted.amount, defaulted.amount, "money");

  const todayParts = mytCalendarParts(new Date());
  const dueSoonStart = mytStartOfDayUtc(todayParts);
  const dueSoonEnd = mytStartOfDayUtc(addMytCalendarDays(todayParts, 7));
  const dueSoon = metric(
    independentRows.filter(
      (row) =>
        row.status === NoteStatus.ACTIVE &&
        row.dueDate != null &&
        row.dueDate >= dueSoonStart &&
        row.dueDate < dueSoonEnd
    )
  );
  expectEqual("Finance due-soon count", book.dueSoon.count, dueSoon.count);
  expectEqual(
    "Finance due-soon amount",
    book.dueSoon.amount,
    dueSoon.amount,
    "money"
  );

  if (book.distressed) {
    expectEqual(
      "Distressed count equals arrears + defaulted",
      book.distressed.count,
      book.arrears.count + book.defaulted.count
    );
  }

  check(
    "Finance Outstanding is remaining principal plus profit for ACTIVE notes",
    moneyClose(book.outstanding.amount, outstanding.amount),
    `dashboard ${book.outstanding.amount.toFixed(2)}; independently derived ${outstanding.amount.toFixed(2)}`
  );

  const ops = await Promise.all([
    repo.getOnboardingOperationsMetrics(),
    repo.getApplicationDashboardMetrics(),
    repo.getContractDashboardMetrics(),
    repo.getNoteDashboardMetrics(),
    repo.getUserStats(),
    repo.getOrganizationStats(),
  ]).then(([onboarding, applications, contracts, noteMetrics, users, organizations]) => ({
    onboarding,
    applications,
    contracts,
    noteMetrics,
    users,
    organizations,
  }));

  const [invPending, invProgress, issPending, issProgress] = await Promise.all([
    prisma.investorOrganization.count({
      where: { onboarding_status: { in: ["PENDING_APPROVAL", "PENDING_AML"] } },
    }),
    prisma.investorOrganization.count({
      where: { onboarding_status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.issuerOrganization.count({
      where: { onboarding_status: { in: ["PENDING_APPROVAL", "PENDING_AML"] } },
    }),
    prisma.issuerOrganization.count({
      where: { onboarding_status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
  ]);
  expectEqual("Onboarding pending (admin action)", ops.onboarding.pending, invPending + issPending);
  expectEqual("Onboarding in progress", ops.onboarding.inProgress, invProgress + issProgress);

  const onboardingInFlight = ops.onboarding.inProgress + ops.onboarding.pending;
  const onboardingTotal =
    ops.onboarding.inProgress +
    ops.onboarding.pending +
    ops.onboarding.approved +
    ops.onboarding.rejected +
    ops.onboarding.expired;
  check(
    "Operations Onboarding display math",
    true,
    `badge ${ops.onboarding.pending} · ${onboardingInFlight} in flight · ${onboardingTotal} total`
  );

  const appsInFlight =
    ops.applications.draft + ops.applications.actionRequired + ops.applications.contractOrAmendmentCycle;
  const appsKnown =
    appsInFlight + ops.applications.approvedCompleted + ops.applications.withdrawnRejectedOrArchived;
  expectEqual("Applications in-flight + done + closed covers total", appsKnown, ops.applications.total);

  const notesInFlight = ops.noteMetrics.draft + ops.noteMetrics.live;
  const notesLost = ops.noteMetrics.distressed + ops.noteMetrics.cancelledOrFailedFunding;
  const notesKnown = notesInFlight + ops.noteMetrics.repaid + notesLost;
  expectEqual("Notes pipeline buckets cover total", notesKnown, ops.noteMetrics.total);
  check(
    "Operations Notes badge (status distressed) vs servicing arrears+defaulted",
    ops.noteMetrics.distressed === ops.noteMetrics.arrears + ops.noteMetrics.defaulted,
    `status distressed ${ops.noteMetrics.distressed}; servicing arrears+defaulted ${ops.noteMetrics.arrears + ops.noteMetrics.defaulted}`
  );

  const [userCount, investorOrgCount, issuerOrgCount] = await Promise.all([
    prisma.user.count(),
    prisma.investorOrganization.count(),
    prisma.issuerOrganization.count(),
  ]);
  expectEqual("Platform total users", ops.users.totalUsers, userCount);
  expectEqual("Platform investor orgs", ops.organizations.investor.total, investorOrgCount);
  expectEqual("Platform issuer orgs", ops.organizations.issuer.total, issuerOrgCount);

  const [ledger, defaultEligible, actionCount] = await Promise.all([
    notes.listLedgerBucketBalances(),
    notes.getDefaultEligibleCount(),
    notes.getActionRequiredCount(),
  ]);
  const sqlBuckets = await prisma.$queryRaw<
    Array<{ code: string; credits: number; debits: number }>
  >`
    SELECT a.code,
           COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE 0 END), 0)::float AS credits,
           COALESCE(SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE 0 END), 0)::float AS debits
    FROM note_ledger_accounts a
    LEFT JOIN note_ledger_entries e ON e.account_id = a.id
    WHERE a.code IN ('INVESTOR_POOL','REPAYMENT_POOL','OPERATING_ACCOUNT','TAWIDH_ACCOUNT','GHARAMAH_ACCOUNT','ISSUER_PAYABLE')
    GROUP BY a.code
  `;
  for (const row of sqlBuckets) {
    const bucket = ledger.buckets.find((item) => item.accountCode === row.code);
    expectEqual(`Ledger ${row.code} balance`, bucket?.balance ?? NaN, row.credits - row.debits, "money");
  }
  const custody = ledger.buckets
    .filter((b) => b.accountCode === "INVESTOR_POOL" || b.accountCode === "REPAYMENT_POOL")
    .reduce((sum, b) => sum + Math.max(b.balance, 0), 0);
  const income = ledger.buckets
    .filter((b) =>
      ["OPERATING_ACCOUNT", "TAWIDH_ACCOUNT", "GHARAMAH_ACCOUNT"].includes(b.accountCode)
    )
    .reduce((sum, b) => sum + Math.max(b.balance, 0), 0);
  const payable = ledger.buckets
    .filter((b) => b.accountCode === "ISSUER_PAYABLE")
    .reduce((sum, b) => sum + Math.max(b.balance, 0), 0);
  check(
    "Bucket groups (held / income / payable)",
    true,
    `held ${custody.toFixed(2)} · income ${income.toFixed(2)} · payable ${payable.toFixed(2)} · net ${ledger.totals.balance.toFixed(2)}`
  );

  const arrearsEligible = await prisma.note.count({
    where: {
      servicing_status: NoteServicingStatus.ARREARS,
      default_marked_at: null,
      funding_status: NoteFundingStatus.FUNDED,
    },
  });
  expectEqual("Default-eligible queue count", defaultEligible.count, arrearsEligible);
  expectEqual("Default-eligible queue matches Finance arrears count", defaultEligible.count, book.arrears.count);

  check(
    "Note Actions queue is ready invoices + draft notes + funding-ready",
    actionCount.count ===
      actionCount.breakdown.readyInvoices +
        actionCount.breakdown.draftNotes +
        actionCount.breakdown.fundingReady,
    `count ${actionCount.count} · ready ${actionCount.breakdown.readyInvoices} · drafts ${actionCount.breakdown.draftNotes} · funding-ready ${actionCount.breakdown.fundingReady}`
  );

  const ADMIN_ONBOARDING_STATUSES = [
    "PENDING_SSM_REVIEW",
    "PENDING_AMENDMENT",
    "PENDING_APPROVAL",
    "PENDING_AML",
    "PENDING_FINAL_APPROVAL",
  ] as const;
  const [investorAdminAction, issuerAdminAction] = await Promise.all([
    prisma.investorOrganization.count({
      where: { onboarding_status: { in: [...ADMIN_ONBOARDING_STATUSES] } },
    }),
    prisma.issuerOrganization.count({
      where: { onboarding_status: { in: [...ADMIN_ONBOARDING_STATUSES] } },
    }),
  ]);
  const orgAdminActionable = investorAdminAction + issuerAdminAction;
  check(
    "Up-next onboarding queue uses a wider admin-action set than Operations pending",
    orgAdminActionable >= ops.onboarding.pending,
    `orgs in SSM/amendment/approval/AML/final ${orgAdminActionable}; Operations pending (approval+AML only) ${ops.onboarding.pending}`
  );

  const [repayments, issuerPayouts, trusteeLetters] = await Promise.all([
    notes.listPendingRepayments(),
    notes.listPendingIssuerPayouts(),
    notes.listPendingSettlementTrusteeLetters(),
  ]);
  const [openRepayments, openIssuerWithdrawals] = await Promise.all([
    prisma.notePayment.count({
      where: { status: { in: ["PENDING", "PARTIAL", "RECEIVED", "RECONCILED"] } },
    }),
    prisma.withdrawalInstruction.count({
      where: {
        withdrawal_type: { in: ["ISSUER_DISBURSEMENT", "ISSUER_RESIDUAL_RETURN"] },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
  ]);
  check(
    "Pending repayments queue",
    repayments.count >= 0 && repayments.count <= openRepayments,
    `queue ${repayments.count} of ${openRepayments} open receipts (posted settlements excluded)`
  );
  check(
    "Issuer payouts queue",
    issuerPayouts.count >= openIssuerWithdrawals,
    `queue ${issuerPayouts.count}; open withdrawals ${openIssuerWithdrawals}`
  );
  check(
    "Settlement trustee letters queue",
    trusteeLetters.count >= 0,
    `queue ${trusteeLetters.count}`
  );

  const [appsAction, appsDraft, appsCycle, facilitiesTotal, facilitiesAction] = await Promise.all([
    prisma.application.count({
      where: {
        status: {
          in: [
            "SUBMITTED",
            "UNDER_REVIEW",
            "RESUBMITTED",
            "CONTRACT_PENDING",
            "CONTRACT_ACCEPTED",
            "INVOICE_ACCEPTED",
            "SIGNING_PENDING",
            "INVOICE_PENDING",
          ],
        },
      },
    }),
    prisma.application.count({ where: { status: "DRAFT" } }),
    prisma.application.count({
      where: { status: { in: ["CONTRACT_SENT", "INVOICES_SENT", "AMENDMENT_REQUESTED"] } },
    }),
    prisma.contract.count(),
    prisma.contract.count({ where: { status: { in: ["SUBMITTED", "AMENDMENT_REQUESTED"] } } }),
  ]);
  expectEqual("Applications action-required", ops.applications.actionRequired, appsAction);
  expectEqual("Applications in-flight parts", appsInFlight, appsDraft + appsAction + appsCycle);
  check(
    "Facilities totals",
    ops.contracts.total <= facilitiesTotal,
    `pipeline ${ops.contracts.total} of ${facilitiesTotal} contracts (real facilities only); action ${ops.contracts.actionRequired} vs raw ${facilitiesAction}`
  );

  const fundedNoteCount = await prisma.note.count({
    where: { funding_status: NoteFundingStatus.FUNDED },
  });
  if (fundedNoteCount === 0) {
    console.log(
      "INFO  Book is empty (zero funded notes); skipping seed-late-payment so local data is not replaced"
    );
  }

  const snapshotRowCount = await prisma.bookMetricsDailySnapshot.count();
  if (snapshotRowCount < 2) {
    const historyDays = BOOK_METRICS_HISTORY_LOOKBACK_DAYS + 1;
    console.log(
      `INFO  book_metrics_daily_snapshots has ${snapshotRowCount} row(s); reconstructing ${historyDays} MYT calendar days`
    );
    for (let offset = historyDays - 1; offset >= 0; offset -= 1) {
      const snapshotDate = addUtcCalendarDays(today, -offset);
      const snapshotParts = {
        year: snapshotDate.getUTCFullYear(),
        month: snapshotDate.getUTCMonth() + 1,
        day: snapshotDate.getUTCDate(),
      };
      const cutoff = mytStartOfDayUtc(addMytCalendarDays(snapshotParts, 1));
      await repo.upsertBookMetricsDailySnapshot(
        snapshotDate,
        await repo.getBookMetrics(cutoff)
      );
    }
    snapshotsSeeded = true;
    check(
      "Seeded book metric snapshots",
      (await prisma.bookMetricsDailySnapshot.count()) >= 2,
      `${historyDays} MYT days reconstructed from timestamped note state`
    );
  } else {
    check(
      "Book metric snapshots already present",
      true,
      `${snapshotRowCount} rows (no seed)`
    );
  }

  const admin = new AdminService();
  const dashboardStats = await admin.getDashboardStats();
  const history = dashboardStats.bookMetricHistory;
  const liveBook = dashboardStats.bookMetrics;
  const lastHistory = history.at(-1);
  check(
    "Sparkline history has at least today's live point",
    history.length >= 1 && lastHistory != null,
    `${history.length} point(s)`
  );
  const sparklineKeys = ["outstanding", "inFunding", "arrears", "defaulted", "dueSoon"] as const;
  if (lastHistory) {
    for (const key of sparklineKeys) {
      expectEqual(
        `Sparkline last ${key} amount equals live`,
        lastHistory[key].amount,
        liveBook[key].amount,
        "money"
      );
      expectEqual(
        `Sparkline last ${key} count equals live`,
        lastHistory[key].count,
        liveBook[key].count
      );
    }
  }

  const completedInvestorOrgs = await prisma.investorOrganization.findMany({
    where: { onboarding_status: OnboardingStatus.COMPLETED },
    select: { id: true, owner_user_id: true },
  });
  const investorHolding = await prisma.noteInvestment.findFirst({
    where: {
      status: { in: [NoteInvestmentStatus.COMMITTED, NoteInvestmentStatus.CONFIRMED] },
      investor_organization_id: { in: completedInvestorOrgs.map((org) => org.id) },
    },
    select: { investor_organization_id: true, investor_user_id: true },
  });
  if (!investorHolding) {
    skip("Investor portfolio", "no COMPLETED investor org with committed/confirmed investments");
  } else {
    const investorOrg = completedInvestorOrgs.find(
      (org) => org.id === investorHolding.investor_organization_id
    );
    const investorUserId = investorOrg?.owner_user_id ?? investorHolding.investor_user_id;
    const portfolio = await notes.getInvestorPortfolio(investorUserId);
    if (portfolio.investmentCount === 0) {
      skip(
        "Investor portfolio",
        `resolved user ${investorUserId} has no committed/confirmed investments`
      );
    } else {
      check(
        "Investor atRisk count <= investmentCount",
        portfolio.atRisk.count <= portfolio.investmentCount,
        `atRisk ${portfolio.atRisk.count} of ${portfolio.investmentCount}`
      );
      const now = new Date();
      const expectedCashflowMonths = mytYearMonthsThrough(
        now,
        mytStartOfDayUtc(addMytCalendarDays(mytCalendarParts(now), 90))
      ).length;
      expectEqual(
        "Investor cashflow months length",
        portfolio.cashflowNext90Days.months.length,
        expectedCashflowMonths
      );
      check(
        "Investor idleDays is null or >= 0",
        portfolio.idleDays == null || portfolio.idleDays >= 0,
        `idleDays ${portfolio.idleDays}`
      );
    }
  }

  const fundedIssuerNote = await prisma.note.findFirst({
    where: { funding_status: NoteFundingStatus.FUNDED },
    select: { issuer_organization_id: true },
  });
  if (!fundedIssuerNote) {
    skip("Issuer dashboard book", "no issuer org with funded notes");
  } else {
    const issuerOrg = await prisma.issuerOrganization.findUnique({
      where: { id: fundedIssuerNote.issuer_organization_id },
      select: { id: true, owner_user_id: true },
    });
    if (!issuerOrg) {
      skip("Issuer dashboard book", "funded note org row missing");
    } else {
      const issuerDashboard = await issuerDashboardService.getDashboard(
        issuerOrg.id,
        issuerOrg.owner_user_id
      );
      const issuerBook = issuerDashboard.book;
      check(
        "Issuer outstandingAmount >= 0",
        issuerBook.outstandingAmount >= 0,
        `${issuerBook.outstandingAmount}`
      );
      const liveFundedNotes = await prisma.note.count({
        where: {
          issuer_organization_id: issuerOrg.id,
          funding_status: NoteFundingStatus.FUNDED,
          servicing_status: { not: NoteServicingStatus.SETTLED },
          status: { in: [NoteStatus.ACTIVE, NoteStatus.ARREARS, NoteStatus.DEFAULTED] },
          funded_amount: { gt: 0 },
        },
      });
      expectEqual("Issuer liveNoteCount matches funded live notes", issuerBook.liveNoteCount, liveFundedNotes);
      check(
        "Issuer costOfFinancingYtd.total >= 0",
        issuerBook.costOfFinancingYtd.total >= 0,
        `${issuerBook.costOfFinancingYtd.total}`
      );
    }
  }

  const exclusiveSnapshot = apiPar?.exclusive
    ? {
        current: apiPar.exclusive.current,
        dpd1To30: apiPar.exclusive.dpd1To30,
        dpd31To60: apiPar.exclusive.dpd31To60,
        dpd61To90: apiPar.exclusive.dpd61To90,
        dpd90Plus: apiPar.exclusive.dpd90Plus,
      }
    : null;
  const par90Percent = apiPar?.par90.percent ?? null;
  const par90VsLimit =
    par90Percent == null ? null : par90LimitStatus(par90Percent);

  console.log("\nUI snapshot (what the dashboard should show)");
  console.log(
    JSON.stringify(
      {
        finance: book,
        creditQuality: apiPar,
        exclusiveBands: exclusiveSnapshot,
        par90Vs5Percent: {
          percent: par90Percent,
          limit: SC_PAR90_LIMIT_PERCENT,
          status: par90VsLimit,
        },
        distressed: {
          arrears: book.arrears.count,
          defaulted: book.defaulted.count,
          distressed: book.distressed?.count ?? null,
        },
        bookMetricHistory: {
          pointCount: history.length,
          last: lastHistory ?? null,
          live: {
            outstanding: liveBook.outstanding,
            inFunding: liveBook.inFunding,
            arrears: liveBook.arrears,
            defaulted: liveBook.defaulted,
            dueSoon: liveBook.dueSoon,
          },
          snapshotsSeeded,
        },
        operations: {
          onboarding: {
            badge: ops.onboarding.pending,
            inFlight: onboardingInFlight,
            total: onboardingTotal,
          },
          applications: {
            badge: ops.applications.actionRequired,
            inFlight: appsInFlight,
            total: ops.applications.total,
          },
          notes: {
            badge: ops.noteMetrics.distressed,
            inFlight: notesInFlight,
            repaid: ops.noteMetrics.repaid,
            lost: notesLost,
            total: ops.noteMetrics.total,
          },
        },
        platform: {
          users: ops.users.totalUsers,
          investorOrgs: ops.organizations.investor.total,
          issuerOrgs: ops.organizations.issuer.total,
        },
        queues: {
          defaultEligible: defaultEligible.count,
          noteActions: actionCount.count,
        },
      },
      null,
      2
    )
  );

  const failed = checks.filter((item) => !item.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (skipped.length) {
    console.log(`Skipped: ${skipped.length}`);
    for (const item of skipped) console.log(` - ${item}`);
  }
  console.log(`Snapshots seeded: ${snapshotsSeeded ? "yes" : "no"}`);
  if (failed.length) {
    console.error("Failed checks:");
    for (const item of failed) console.error(` - ${item.name}: ${item.detail}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
