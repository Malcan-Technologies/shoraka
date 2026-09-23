import { PrismaClient } from '@prisma/client';
import { formatCurrency, formatNumber } from '@cashsouk/config';
import {
  resolveAdminFinancialReviewColumns,
  receivablesDaysUnavailableReason,
  // CTOS highlights
  resolveCtosReturnOnEquityPercent,
  resolveCtosPatMarginPercent,
  resolveCtosReturnOnAssetsPercent,
  resolveCtosTotalAssetTurnover,
  resolveCtosGearingRatio,
  resolveCtosCurrentRatio,
  resolveCtosTotalAssets,
  resolveCtosTotalLiabilities,
  // issuer calc helpers
  computeColumnMetrics,
  financialFormToBsPl,
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
const notAvailable = 'Not available';

function isFiniteNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function getCtosAccountForFY(financials_json: any, fy: number) {
  const arr = Array.isArray(financials_json) ? financials_json : financials_json?.financials;
  if (!Array.isArray(arr)) return null;
  const row = arr.find((x) => String(x?.financial_year ?? '') === String(fy));
  return (row?.account ?? null) as AnyRec | null;
}

function fmtCurrency0(n: number | null | undefined) {
  if (!isFiniteNum(n)) return notAvailable;
  return n === 0 ? formatCurrency(0, { decimals: 0 }) : formatCurrency(n, { decimals: 0 });
}
function fmtRatio2(n: number | null | undefined) {
  if (!isFiniteNum(n)) return notAvailable;
  return formatNumber(n, 2);
}
function fmtPct2(points: number | null | undefined) {
  if (!isFiniteNum(points)) return notAvailable;
  return `${formatNumber(points, 2)}%`;
}
function fmtX2(x: number | null | undefined) {
  if (!isFiniteNum(x)) return notAvailable;
  return `${formatNumber(x, 2)}x`;
}

async function main() {
  const prisma = new PrismaClient();
  const note = await prisma.note.findFirst({
    where: { note_reference: { endsWith: '-02' } },
    select: { id: true, source_application_id: true, issuer_organization_id: true },
  });
  if (!note) throw new Error('note -02 not found');

  const app = await prisma.application.findUnique({
    where: { id: note.source_application_id },
    select: { id: true, financial_statements: true },
  });
  if (!app) throw new Error('app missing');

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

  const ctosFinancials = ctos.financials_json;

  const resolvedColumns = resolveAdminFinancialReviewColumns({
    financialStatements: app.financial_statements,
    ctosFinancials,
    ref: new Date(),
  });
  const colByYear = Object.fromEntries(resolvedColumns.map((c) => [c.year as number, c]));

  console.log('SEED APP ID:', app.id);
  console.log('ISSUER ORG ID:', issuerOrg?.id);
  console.log('ORG NAME:', issuerOrg?.name);
  console.log('SSM/REG:', issuerOrg?.registration_number);

  console.log('\nFY source matrix:');
  for (const fy of [2023, 2024, 2025, 2026]) {
    const col = (colByYear as any)[fy];
    if (!col) console.log(`FY${fy}: MISSING`);
    else console.log(`FY${fy}: kind=${col.kind} primary=${col.primarySource} recordSource=${col.recordSource}`);
  }

  function rv(col: any, key: string): number | null {
    const v = col?.fields?.[key]?.value;
    return isFiniteNum(v) ? v : null;
  }

  // Show CTOS direct/finished inputs and the 4 preserved raw fields mapping.
  console.log('\nCTOS stored + resolved for FY2023/FY2024:');
  for (const fy of [2023, 2024]) {
    const acct = getCtosAccountForFY(ctosFinancials, fy);
    const col = (colByYear as any)[fy];
    console.log(`\nFY${fy}`);
    console.log('CTOS account keys presence:', {
      return_on_equity: acct?.return_on_equity ?? null,
      gear: acct?.gear ?? null,
      currat: acct?.currat ?? null,
      workcap: acct?.workcap ?? null,
      turnover_growth: acct?.turnover_growth ?? null,
      bsqres: acct?.bsqres ?? null,
      bsqupro: acct?.bsqupro ?? null,
      bsqmint: acct?.bsqmint ?? null,
      plminin: acct?.plminin ?? null,
    });
    console.log('Mapped resolved raw fields:', {
      equity_share_premium: col?.fields?.equity_share_premium ?? null,
      equity_accumulated_profit: col?.fields?.equity_accumulated_profit ?? null,
      equity_minority: col?.fields?.equity_minority ?? null,
      pl_minority: col?.fields?.pl_minority ?? null,
    });
  }

  // FY2025 absence
  const fs = app.financial_statements ?? {};
  console.log('\nFY2025 stored block present?:', {
    unaudited_by_year_2025: fs.unaudited_by_year?.['2025'] != null,
    admin_input_by_year_2025: fs.admin_input_by_year?.['2025'] != null,
  });

  // FY2026 raw user input fields subset
  const unaudited2026 = fs.unaudited_by_year?.['2026'] ?? null;
  console.log('\nFY2026 user input raw subset:', {
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

  // Compute metrics as the Admin component would (CTOS column: CTOS highlights + fallbacks; non-ctos: computeColumnMetrics + formulas).
  function computeCTOSMetrics(fy: number) {
    const col = (colByYear as any)[fy];
    const acct = getCtosAccountForFY(ctosFinancials, fy) ?? {};

    const totass = resolveCtosTotalAssets(acct);
    const totlib = resolveCtosTotalLiabilities(acct);
    const networth = isFiniteNum(acct.networth) ? (acct.networth as number) : null;

    const turnoverThis = acct.turnover ?? null;
    const turnoverPrev = getCtosAccountForFY(ctosFinancials, fy - 1)?.turnover ?? null;

    // turnover_growth display uses CTOS fallback computeTurnoverGrowth when direct turnover_growth missing
    const g = computeTurnoverGrowth({ targetYear: fy, targetTurnover: turnoverThis, priorYear: fy - 1, priorTurnover: turnoverPrev });
    const turnoverGrowthDisp = g == null ? notAvailable : `${formatNumber(g * 100, 2)}%`;

    const patMarginPct = resolveCtosPatMarginPercent({ plnpat: acct.plnpat ?? null, turnover: acct.turnover ?? null });
    const patMarginDisp = patMarginPct == null ? notAvailable : `${formatNumber(patMarginPct, 2)}%`;

    // current ratio: direct currat if present else fallback from current assets/liabilities
    const directCurrat = resolveCtosCurrentRatio({ currat: acct.currat ?? null });
    const curratRatio = directCurrat ?? computeCurrentRatio(rv(col, 'bscatot'), rv(col, 'curlib'));
    const currentRatioDisp = curratRatio == null ? notAvailable : fmtRatio2(curratRatio);

    const quick = computeQuickRatio(rv(col, 'cashAndBank'), rv(col, 'tradeReceivables'), rv(col, 'curlib'));
    const quickRatioDisp = quick == null ? notAvailable : fmtRatio2(quick);

    const wc = computeWorkingCapital(rv(col, 'bscatot'), rv(col, 'curlib'));
    const workcapDisp = wc == null ? notAvailable : fmtCurrency0(wc);

    // ROE: component tries CTOS return_on_equity first, else uses resolvedByYear.fields.plnpat + resolvedByYear.fields.networth.
    const directRoePct = resolveCtosReturnOnEquityPercent({ return_on_equity: acct.return_on_equity ?? null });
    let roeDisp = notAvailable;
    let roeSource: string = '';
    if (directRoePct != null) {
      roeDisp = `${formatNumber(directRoePct, 2)}%`;
      roeSource = 'CTOS finished value';
    } else {
      const pat = rv(col, 'plnpat');
      // NOTE: networth is calculated metric key, so resolvedByYear.fields.networth is typically undefined.
      const netWorthVal = rv(col, 'networth');
      const ratio = resolveFinancialSummaryIssuerReturnOnEquityRatio({ plnpat: pat, netWorth: netWorthVal });
      roeDisp = ratio == null ? notAvailable : `${formatNumber(ratio * 100, 2)}%`;
      roeSource = ratio == null ? 'Cannot calculate (missing resolved net worth)' : 'Excel-formula fallback';
    }

    const roaPct = resolveCtosReturnOnAssetsPercent({ plnpat: acct.plnpat ?? null, totass: acct.totass ?? null });
    const roaDisp = roaPct == null ? notAvailable : `${formatNumber(roaPct, 2)}%`;

    const assetTurnover = resolveCtosTotalAssetTurnover({ turnover: acct.turnover ?? null, totass: acct.totass ?? null });
    const assetTurnoverDisp = assetTurnover == null ? notAvailable : `${formatNumber(assetTurnover, 2)}x`;

    const ebit = computeEbit(rv(col, 'plnpbt'), rv(col, 'interest_cost'));
    const ebitDisp = ebit == null ? notAvailable : fmtCurrency0(ebit);

    const ic = computeInterestCoverage(ebit, rv(col, 'interest_cost'));
    const interestCoverageDisp = ic == null ? notAvailable : `${formatNumber(ic, 2)}x`;

    const gear = resolveCtosGearingRatio({ gear: acct.gear ?? null, totlib: acct.totlib ?? null, networth: acct.networth ?? null });
    const gearingDisp = gear == null ? notAvailable : `${formatNumber(gear, 2)}x`;

    const netDebt = computeNetDebtEquity({
      curlib_borrowing: rv(col, 'curlib_borrowing'),
      ncl_loan: rv(col, 'ncl_loan'),
      cashAndBank: rv(col, 'cashAndBank'),
      networth: acct.networth ?? null,
    });
    const netDebtEquityDisp = netDebt == null ? notAvailable : `${formatNumber(netDebt, 2)}x`;

    const receivablesEnding = rv(col, 'tradeReceivables');
    const receivablesPrior = (colByYear as any)[fy - 1]?.fields?.tradeReceivables?.value ?? null;
    const turnoverForReceivables = rv(col, 'turnover');
    const receivablesReason = receivablesDaysUnavailableReason({ year: fy, endingTradeReceivables: receivablesEnding, priorTradeReceivables: receivablesPrior, turnover: turnoverForReceivables });
    let receivablesDaysDisp = notAvailable;
    if (!receivablesReason) {
      const days = computeReceivablesDays(receivablesPrior, receivablesEnding, turnoverForReceivables);
      receivablesDaysDisp = days == null ? notAvailable : formatNumber(days, 2);
    }

    const payablesDaysVal = computePayablesDays(rv(col, 'tradePayables'), rv(col, 'costOfSales'));
    const payablesDaysDisp = payablesDaysVal == null ? notAvailable : formatNumber(payablesDaysVal, 2);

    const dscrVal = computeDscr(rv(col, 'netOperatingIncome'), rv(col, 'annualDebtService'));
    const dscrDisp = dscrVal == null ? notAvailable : `${formatNumber(dscrVal, 2)}x`;

    return {
      totalAssetsDisp: fmtCurrency0(totass),
      totalLiabilitiesDisp: fmtCurrency0(totlib),
      netWorthDisp: fmtCurrency0(networth),
      ebitDisp,
      turnoverGrowthDisp,
      patMarginDisp,
      currentRatioDisp,
      quickRatioDisp,
      workcapDisp,
      roeDisp,
      roaDisp,
      assetTurnoverDisp,
      gearingDisp,
      netDebtEquityDisp,
      interestCoverageDisp,
      receivablesDaysDisp,
      receivablesReason,
      payablesDaysDisp,
      dscrDisp,
      roeSource,
    };
  }

  function computeUserInputMetrics(fy: number) {
    const col = (colByYear as any)[fy];
    const rawFS = (fs.unaudited_by_year?.[String(fy)] ?? fs.admin_input_by_year?.[String(fy)]) as AnyRec | undefined;
    // resolved fields overlay the same raw keys, but keep as in UI.
    const g = computeTurnoverGrowth({
      targetYear: fy,
      targetTurnover: col?.fields?.turnover?.value ?? rawFS?.turnover ?? null,
      priorYear: fy - 1,
      priorTurnover: (colByYear as any)[fy - 1]?.fields?.turnover?.value ?? null,
    });

    const fsMerged: AnyRec = { ...(rawFS ?? {}) };
    if (col?.fields) {
      for (const [key, field] of Object.entries(col.fields)) {
        if (field?.value != null) fsMerged[key] = field.value;
      }
    }

    const input = financialFormToBsPl(fsMerged);
    const metrics = computeColumnMetrics(input.bs, input.pl, g);
    // Admin component overrides return_of_equity to use PAT ÷ computed net worth.
    const roeRatio = resolveFinancialSummaryIssuerReturnOnEquityRatio({
      plnpat: input.pl.profit_after_tax,
      netWorth: metrics.networth,
    });

    const totass = metrics.totass;
    const totlib = metrics.totlib;
    const networth = metrics.networth;

    const ebit = computeEbit(fsMerged.plnpbt ?? null, fsMerged.interest_cost ?? null);
    const ic = computeInterestCoverage(ebit, fsMerged.interest_cost ?? null);

    const quick = computeQuickRatio(fsMerged.cashAndBank ?? null, fsMerged.tradeReceivables ?? null, fsMerged.curlib ?? null);

    const wc = computeWorkingCapital(fsMerged.bscatot ?? null, fsMerged.curlib ?? null);

    const roa = (input.pl.profit_after_tax != null && totass != null && totass !== 0)
      ? (input.pl.profit_after_tax / totass) * 100
      : null;

    const assetTurnover = (fsMerged.turnover != null && totass != null && totass !== 0)
      ? fsMerged.turnover / totass
      : null;

    const gear = (totlib != null && networth != null && networth !== 0)
      ? totlib / networth
      : null;

    const netDebt = computeNetDebtEquity({
      curlib_borrowing: fsMerged.curlib_borrowing ?? null,
      ncl_loan: fsMerged.ncl_loan ?? null,
      cashAndBank: fsMerged.cashAndBank ?? null,
      networth,
    });

    const endingAR = fsMerged.tradeReceivables ?? null;
    const priorAR = (colByYear as any)[fy - 1]?.fields?.tradeReceivables?.value ?? null;
    const turnoverForReceivables = fsMerged.turnover ?? null;
    const receivablesReason = receivablesDaysUnavailableReason({ year: fy, endingTradeReceivables: endingAR, priorTradeReceivables: priorAR, turnover: turnoverForReceivables });
    let receivablesDaysDisp = notAvailable;
    if (!receivablesReason) {
      const days = computeReceivablesDays(priorAR, endingAR, turnoverForReceivables);
      receivablesDaysDisp = days == null ? notAvailable : formatNumber(days, 2);
    }

    const payablesDaysVal = computePayablesDays(fsMerged.tradePayables ?? null, fsMerged.costOfSales ?? null);
    const dscrVal = computeDscr(fsMerged.netOperatingIncome ?? null, fsMerged.annualDebtService ?? null);

    return {
      totalAssetsDisp: fmtCurrency0(totass),
      totalLiabilitiesDisp: fmtCurrency0(totlib),
      netWorthDisp: fmtCurrency0(networth),
      ebitDisp: ebit == null ? notAvailable : fmtCurrency0(ebit),
      turnoverGrowthDisp: metrics.turnover_growth == null ? notAvailable : `${formatNumber(metrics.turnover_growth * 100, 2)}%`,
      patMarginDisp: metrics.profit_margin == null ? notAvailable : `${formatNumber(metrics.profit_margin * 100, 2)}%`,
      currentRatioDisp: metrics.currat == null ? notAvailable : fmtRatio2(metrics.currat),
      quickRatioDisp: quick == null ? notAvailable : fmtRatio2(quick),
      workcapDisp: wc == null ? notAvailable : fmtCurrency0(wc),
      roeDisp: roeRatio == null ? notAvailable : `${formatNumber(roeRatio * 100, 2)}%`,
      roaDisp: roa == null ? notAvailable : `${formatNumber(roa, 2)}%`,
      assetTurnoverDisp: assetTurnover == null ? notAvailable : `${formatNumber(assetTurnover, 2)}x`,
      gearingDisp: gear == null ? notAvailable : `${formatNumber(gear, 2)}x`,
      netDebtEquityDisp: netDebt == null ? notAvailable : `${formatNumber(netDebt, 2)}x`,
      interestCoverageDisp: ic == null ? notAvailable : `${formatNumber(ic, 2)}x`,
      receivablesDaysDisp,
      receivablesReason,
      payablesDaysDisp: payablesDaysVal == null ? notAvailable : formatNumber(payablesDaysVal, 2),
      dscrDisp: dscrVal == null ? notAvailable : `${formatNumber(dscrVal, 2)}x`,
    };
  }

  const metrics: Record<number, any> = {};
  for (const fy of [2023, 2024, 2026]) {
    const col = (colByYear as any)[fy];
    if (!col) continue;
    metrics[fy] = col.kind === 'ctos' ? computeCTOSMetrics(fy) : computeUserInputMetrics(fy);
  }

  console.log('\nFULL METRIC DISPLAY TABLE (per Admin Financial Summary rows)');
  const order = [
    ['Total Assets', 'totalAssetsDisp'],
    ['Total Liabilities', 'totalLiabilitiesDisp'],
    ['Total Equity / Net Worth', 'netWorthDisp'],
    ['EBIT', 'ebitDisp'],
    ['Turnover Growth', 'turnoverGrowthDisp'],
    ['Net Profit Margin / PAT Margin', 'patMarginDisp'],
    ['Current Ratio', 'currentRatioDisp'],
    ['Quick Ratio', 'quickRatioDisp'],
    ['Working Capital', 'workcapDisp'],
    ['ROE', 'roeDisp'],
    ['ROA', 'roaDisp'],
    ['Asset Turnover', 'assetTurnoverDisp'],
    ['Debt / Equity', 'gearingDisp'],
    ['Gearing', 'gearingDisp'],
    ['Net Debt / Equity', 'netDebtEquityDisp'],
    ['Interest Coverage', 'interestCoverageDisp'],
    ['Receivables Days', 'receivablesDaysDisp'],
    ['Payables Days', 'payablesDaysDisp'],
    ['DSCR', 'dscrDisp'],
  ] as const;

  // Print markdown-ish table (simple)
  console.log(['Metric', 'FY2023', 'FY2024', 'FY2026'].join(' | '));
  console.log(['---', '---', '---', '---'].join(' | '));
  for (const [label, key] of order as any) {
    const v23 = metrics[2023]?.[key] ?? notAvailable;
    const v24 = metrics[2024]?.[key] ?? notAvailable;
    const v26 = metrics[2026]?.[key] ?? notAvailable;
    console.log([label, v23, v24, v26].join(' | '));
  }

  // Extra: list explicit cannot-calculate inputs for key metrics
  console.log('\nCannot-calculate reasons (exact missing drivers):');
  for (const fy of [2023, 2024, 2026]) {
    const col = (colByYear as any)[fy];
    if (!col) continue;
    console.log(`\nFY${fy}`);
    const quick = computeQuickRatio(rv(col, 'cashAndBank'), rv(col, 'tradeReceivables'), rv(col, 'curlib'));
    if (quick == null) {
      console.log('Quick Ratio: Missing:', {
        cashAndBank: rv(col, 'cashAndBank'),
        tradeReceivables: rv(col, 'tradeReceivables'),
        curlib: rv(col, 'curlib'),
      });
    }
    const endingAR = rv(col, 'tradeReceivables');
    const priorAR = (colByYear as any)[fy - 1]?.fields?.tradeReceivables?.value ?? null;
    const turnover = rv(col, 'turnover');
    const rReason = receivablesDaysUnavailableReason({ year: fy, endingTradeReceivables: endingAR, priorTradeReceivables: priorAR, turnover });
    if (rReason) console.log('Receivables Days:', rReason);

    const dscr = computeDscr(rv(col, 'netOperatingIncome'), rv(col, 'annualDebtService'));
    if (dscr == null) {
      console.log('DSCR missing:', {
        netOperatingIncome: rv(col, 'netOperatingIncome'),
        annualDebtService: rv(col, 'annualDebtService'),
      });
    }

    // ROE specific
    if (metrics[fy]?.roeDisp === notAvailable) {
      console.log('ROE not available drivers:', {
        ctos_return_on_equity: getCtosAccountForFY(ctosFinancials, fy)?.return_on_equity ?? null,
        resolved_networth_raw_field_exists: rv(col, 'networth') != null,
        resolved_plnpat: rv(col, 'plnpat'),
      });
    }
  }

  // Gearing display check
  console.log('\nGearing display format check (gear is shown with x):');
  for (const fy of [2023, 2024, 2026]) {
    console.log(`FY${fy} gearing:`, metrics[fy]?.gearingDisp);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
