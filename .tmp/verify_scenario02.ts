import { PrismaClient } from '@prisma/client';
import { formatCurrency, formatNumber } from '@cashsouk/config';
import {
  resolveAdminFinancialReviewColumns,
  receivablesDaysUnavailableReason,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
  resolveCtosReturnOnEquityPercent,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosTotalAssetTurnover,
  resolveCtosGearingRatio,
  resolveCtosCurrentRatio,
  computeTurnoverGrowth,
  computeEbit,
  computeInterestCoverage,
  computeCurrentRatio,
  computeQuickRatio,
  computeWorkingCapital,
  computeReceivablesDays,
  computePayablesDays,
  computeDscr,
  computeNetDebtEquity,
  resolveFinancialSummaryIssuerReturnOnEquityRatio,
} from '@cashsouk/types';

type AnyRec = Record<string, any>;

function fmtAmount0(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return 'Not available';
  return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
}

function fmtPct2(points: number | null | undefined) {
  if (points == null || !Number.isFinite(points)) return 'Not available';
  return `${formatNumber(points, 2)}%`;
}

function fmtX2(x: number | null | undefined) {
  if (x == null || !Number.isFinite(x)) return 'Not available';
  return `${formatNumber(x, 2)}x`;
}

function getCtosAccountForFY(financials_json: any, fy: number) {
  const arr = Array.isArray(financials_json) ? financials_json : financials_json?.financials;
  if (!Array.isArray(arr)) return null;
  const row = arr.find((x) => String(x?.financial_year ?? '') === String(fy));
  return (row?.account ?? null) as AnyRec | null;
}

(async () => {
  const prisma = new PrismaClient();
  const note = await prisma.note.findFirst({
    where: { note_reference: { endsWith: '-02' } },
    select: { id: true, note_reference: true, source_application_id: true, issuer_organization_id: true },
  });
  if (!note) throw new Error('note -02 not found');

  const app = await prisma.application.findUnique({
    where: { id: note.source_application_id },
    select: { id: true, financial_statements: true },
  });
  if (!app) throw new Error('app not found');

  const issuerOrg = await prisma.issuerOrganization.findUnique({
    where: { id: note.issuer_organization_id },
    select: { id: true, name: true, registration_number: true },
  });

  const ctos = await prisma.ctosReport.findFirst({
    where: { issuer_organization_id: note.issuer_organization_id },
    orderBy: { fetched_at: 'desc' },
    select: { id: true, financials_json: true },
  });
  if (!ctos) throw new Error('ctos report missing');

  const columns = resolveAdminFinancialReviewColumns({
    financialStatements: app.financial_statements,
    ctosFinancials: ctos.financials_json,
    ref: new Date(),
  });
  const colByYear = Object.fromEntries(columns.map((c) => [c.year as number, c]));

  console.log('SEED APP ID:', app.id);
  console.log('ISSUER ORG ID:', issuerOrg?.id);
  console.log('ORG NAME:', issuerOrg?.name);
  console.log('SSM/REG:', issuerOrg?.registration_number);

  console.log('\nFY source matrix:');
  for (const fy of [2023, 2024, 2025, 2026]) {
    const col = (colByYear as any)[fy];
    if (!col) {
      console.log(`FY${fy}: MISSING`);
    } else {
      console.log(`FY${fy}: kind=${col.kind} primary=${col.primarySource} recordSource=${col.recordSource}`);
    }
  }

  console.log('\nCTOS stored account + resolved raw mappings (FY2023/FY2024)');
  for (const fy of [2023, 2024]) {
    const acct = getCtosAccountForFY(ctos.financials_json, fy);
    const col = (colByYear as any)[fy];
    console.log(`\nFY${fy}`);
    console.log('CTOS raw account:', {
      totass: acct?.totass,
      totlib: acct?.totlib,
      networth: acct?.networth,
      turnover_growth: acct?.turnover_growth,
      currat: acct?.currat,
      workcap: acct?.workcap,
      return_on_equity: acct?.return_on_equity,
      gear: acct?.gear,
      bsqres: acct?.bsqres,
      bsqupro: acct?.bsqupro,
      bsqmint: acct?.bsqmint,
      plminin: acct?.plminin,
    });
    if (col) {
      console.log('Resolved raw (for 4 fields + ROE helpers):', {
        equity_share_premium: col.fields.equity_share_premium,
        equity_accumulated_profit: col.fields.equity_accumulated_profit,
        equity_minority: col.fields.equity_minority,
        pl_minority: col.fields.pl_minority,
        plnpat: col.fields.plnpat,
        networth: col.fields.networth,
      });
    }
  }

  // Quick function: return resolved raw value or null
  function rawVal(f: any, key: string): number | null {
    const v = f?.fields?.[key]?.value;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }

  // For turnover_growth fallback on CTOS, use raw account turnover values.
  function turnoverFY(fy: number) {
    return getCtosAccountForFY(ctos.financials_json, fy)?.turnover ?? null;
  }

  function computeMetricDisplay(fy: number) {
    const col = (colByYear as any)[fy];
    if (!col) return null;
    const isCtos = col.kind === 'ctos';
    const f = col.fields;
    const acct = isCtos ? getCtosAccountForFY(ctos.financials_json, fy) ?? {} : {};

    // Totals
    const totass = isCtos ? resolveCtosTotalAssets(acct) : rawVal(col, 'totass');
    const totlib = isCtos ? resolveCtosTotalLiabilities(acct) : rawVal(col, 'totlib');
    const networth = isCtos ? (acct?.networth ?? null) : rawVal(col, 'networth');

    // Turnover growth
    let turnoverGrowth: string = 'Not available';
    if (isCtos) {
      const g = computeTurnoverGrowth({ targetYear: fy, targetTurnover: acct.turnover ?? null, priorYear: fy - 1, priorTurnover: turnoverFY(fy - 1) });
      turnoverGrowth = g == null ? 'Not available' : `${formatNumber(g * 100, 2)}%`;
    } else {
      const tThis = rawVal(col, 'turnover');
      const tPrev = (colByYear as any)[fy - 1]?.fields?.turnover?.value ?? null;
      const g = computeTurnoverGrowth({ targetYear: fy, targetTurnover: tThis, priorYear: fy - 1, priorTurnover: tPrev });
      turnoverGrowth = g == null ? 'Not available' : `${formatNumber(g * 100, 2)}%`;
    }

    // PAT margin
    let patMargin = 'Not available';
    if (isCtos) {
      const pct = resolveCtosPatMarginPercent({ plnpat: acct.plnpat ?? null, turnover: acct.turnover ?? null });
      patMargin = pct == null ? 'Not available' : `${formatNumber(pct, 2)}%`;
    } else {
      const pat = rawVal(col, 'plnpat');
      const turnover = rawVal(col, 'turnover');
      if (pat != null && turnover != null && turnover !== 0) patMargin = `${formatNumber((pat / turnover) * 100, 2)}%`;
    }

    // Current ratio
    let currentRatio = 'Not available';
    if (isCtos) {
      const direct = resolveCtosCurrentRatio({ currat: acct.currat ?? null });
      if (direct != null) currentRatio = formatNumber(direct, 2);
      else {
        const ratio = computeCurrentRatio(rawVal(col, 'bscatot'), rawVal(col, 'curlib'));
        currentRatio = ratio == null ? 'Not available' : formatNumber(ratio, 2);
      }
    } else {
      const ratio = computeCurrentRatio(rawVal(col, 'bscatot'), rawVal(col, 'curlib'));
      currentRatio = ratio == null ? 'Not available' : formatNumber(ratio, 2);
    }

    // Quick ratio
    const quick = computeQuickRatio(rawVal(col, 'cashAndBank'), rawVal(col, 'tradeReceivables'), rawVal(col, 'curlib'));
    const quickRatio = quick == null ? 'Not available' : formatNumber(quick, 2);

    // Working capital
    const wc = computeWorkingCapital(rawVal(col, 'bscatot'), rawVal(col, 'curlib'));
    const workcap = wc == null ? 'Not available' : fmtX2(null) && fmtAmount0(wc); // amount

    // ROE
    let roe = 'Not available';
    if (isCtos) {
      const pct = resolveCtosReturnOnEquityPercent({ return_on_equity: acct.return_on_equity ?? null });
      if (pct != null) roe = `${formatNumber(pct, 2)}%`;
      else {
        const ratio = resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: rawVal(col, 'plnpat'), netWorth: rawVal(col, 'networth') });
        roe = ratio == null ? 'Not available' : `${formatNumber(ratio * 100, 2)}%`;
      }
    } else {
      const ratio = resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: rawVal(col, 'plnpat'), netWorth: rawVal(col, 'networth') });
      roe = ratio == null ? 'Not available' : `${formatNumber(ratio * 100, 2)}%`;
    }

    // ROA
    const roaPct = isCtos ? resolveCtosReturnOnAssetsPercent({ plnpat: acct.plnpat ?? null, totass: acct.totass ?? null }) : null;
    const roa = roaPct == null ? 'Not available' : `${formatNumber(roaPct, 2)}%`;

    // Asset turnover
    const at = resolveCtosTotalAssetTurnover({ turnover: acct.turnover ?? null, totass: acct.totass ?? null });
    const assetTurnover = at == null ? 'Not available' : `${formatNumber(at, 2)}x`;

    // EBIT + Interest coverage
    const ebit = computeEbit(rawVal(col, 'plnpbt'), rawVal(col, 'interest_cost'));
    const ebitDisp = ebit == null ? 'Not available' : formatCurrency(ebit, { decimals: 0 });
    const ic = computeInterestCoverage(ebit, rawVal(col, 'interest_cost'));
    const interestCoverage = ic == null ? 'Not available' : `${formatNumber(ic, 2)}x`;

    // Gearing
    const gear = resolveCtosGearingRatio({ gear: acct.gear ?? null, totlib: acct.totlib ?? null, networth: acct.networth ?? null });
    const gearing = gear == null ? 'Not available' : `${formatNumber(gear, 2)}x`;

    // Net debt/equity
    const netDebt = computeNetDebtEquity({
      curlibBorrowing: rawVal(col, 'curlib_borrowing'),
      nclLoan: rawVal(col, 'ncl_loan'),
      cashAndBank: rawVal(col, 'cashAndBank'),
      networth: isCtos ? acct.networth ?? null : rawVal(col, 'networth'),
    });
    const netDebtEquity = netDebt == null ? 'Not available' : `${formatNumber(netDebt, 2)}x`;

    // Receivables days
    const endingAR = rawVal(col, 'tradeReceivables');
    const priorCol = (colByYear as any)[fy - 1];
    const priorAR = priorCol?.fields?.tradeReceivables?.value ?? null;
    const turnover = rawVal(col, 'turnover');
    const reason = receivablesDaysUnavailableReason({ year: fy, endingTradeReceivables: endingAR, priorTradeReceivables: priorAR, turnover });
    let receivablesDays = 'Not available';
    if (!reason) {
      const days = computeReceivablesDays(priorAR, endingAR, turnover);
      receivablesDays = days == null ? 'Not available' : formatNumber(days, 2);
    }

    // Payables days
    const pd = computePayablesDays(rawVal(col, 'tradePayables'), rawVal(col, 'costOfSales'));
    const payablesDays = pd == null ? 'Not available' : formatNumber(pd, 2);

    // DSCR
    const dscr = computeDscr(rawVal(col, 'netOperatingIncome'), rawVal(col, 'annualDebtService'));
    const dscrDisp = dscr == null ? 'Not available' : `${formatNumber(dscr, 2)}x`;

    return {
      totalAssets: fmtAmount0(totass),
      totalLiabilities: fmtAmount0(totlib),
      netWorth: fmtAmount0(networth),
      ebit: ebitDisp,
      turnoverGrowth,
      patMargin,
      currentRatio,
      quickRatio,
      workcap: wc == null ? 'Not available' : fmtAmount0(wc),
      roe,
      roa,
      assetTurnover,
      gearing,
      netDebtEquity,
      interestCoverage,
      receivablesDays,
      receivablesReason: reason,
      payablesDays,
      dscr: dscrDisp,
    };
  }

  const metricTable = [2023, 2024, 2026].map((fy) => ({ fy, metrics: computeMetricDisplay(fy) }));

  console.log('\nCalculated metrics display values (CTOS + user input)');
  for (const row of metricTable) {
    console.log(`\nFY${row.fy}:`);
    console.log(row.metrics);
  }

  // FY2025 absence
  const fs = app.financial_statements ?? {};
  console.log('\nFY2025 absence check:', {
    unaudited_by_year_2025: fs.unaudited_by_year?.['2025'] ? true : false,
    admin_input_by_year_2025: fs.admin_input_by_year?.['2025'] ? true : false,
  });

  const unaudited2026 = fs.unaudited_by_year?.['2026'] ?? null;
  console.log('\nFY2026 raw keys check:', {
    equity_share_premium: unaudited2026?.equity_share_premium,
    equity_accumulated_profit: unaudited2026?.equity_accumulated_profit,
    equity_minority: unaudited2026?.equity_minority,
    pl_minority: unaudited2026?.pl_minority,
    cashAndBank: unaudited2026?.cashAndBank,
    tradeReceivables: unaudited2026?.tradeReceivables,
    curlib_borrowing: unaudited2026?.curlib_borrowing,
    ncl_loan: unaudited2026?.ncl_loan,
    tradePayables: unaudited2026?.tradePayables,
    costOfSales: unaudited2026?.costOfSales,
    interest_cost: unaudited2026?.interest_cost,
    netOperatingIncome: unaudited2026?.netOperatingIncome,
    annualDebtService: unaudited2026?.annualDebtService,
  });

  await prisma.$disconnect();
})();
