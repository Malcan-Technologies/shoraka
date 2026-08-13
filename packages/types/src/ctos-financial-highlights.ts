/**
 * SECTION: Official CTOS Financial Highlights resolvers
 * WHY: Prospectus must use CTOS raw fields or exact CTOS ENQWS v5.11.0 XSL formulas only
 * INPUT: Flattened CTOS/account-year numbers (same keys as financials_json[].account)
 * OUTPUT: Metric numbers or null when official inputs are missing/invalid
 * WHERE USED: Prospectus Page 2/3 resolvers, Admin working tables, freeze/preview paths
 *
 * Source of truth: CTOS ENQWS v5.11.0 Financial Highlights XSL
 * (`3. Stylesheet/subreport/section_b_subreport.xsl` / SME twin).
 *
 * No invented formulas. No officer overrides. No similar-metric substitution.
 */

function isFinitePresent(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

/** Account slice used by official Highlights formulas (and direct fields). */
export type CtosFinancialHighlightAccount = {
  turnover?: number | null;
  plnpat?: number | null;
  totass?: number | null;
  totlib?: number | null;
  networth?: number | null;
  bscatot?: number | null;
  curlib?: number | null;
  /** Official CTOS Gearing Ratio raw field (`r:gear`). */
  gear?: number | null;
  /**
   * Official CTOS PBT Margin (`r:profit_margin`).
   * Never use as Prospectus Net Profit Margin / PAT Margin.
   */
  profit_margin?: number | null;
  return_on_equity?: number | null;
  currat?: number | null;
  workcap?: number | null;
};

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Return On Equity (ROE) [%]:
 * Direct field only: `r:return_on_equity`.
 * No official XSL fallback (never plnpat/networth or totass−totlib).
 * Returns percent points (e.g. 15.2 means 15.2%).
 */
export function resolveCtosReturnOnEquityPercent(
  account: CtosFinancialHighlightAccount
): number | null {
  if (!isFinitePresent(account.return_on_equity)) return null;
  return account.return_on_equity;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Current Ratio:
 * Direct field only: `r:currat`.
 * No official XSL fallback (never bscatot/curlib).
 */
export function resolveCtosCurrentRatio(
  account: CtosFinancialHighlightAccount
): number | null {
  if (!isFinitePresent(account.currat)) return null;
  return account.currat;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights — Total Assets:
 * Direct field only: `r:totass`.
 * No component reconstruction for Prospectus.
 */
export function resolveCtosTotalAssets(
  account: CtosFinancialHighlightAccount
): number | null {
  if (!isFinitePresent(account.totass)) return null;
  return account.totass;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights — Total Liabilities:
 * Direct field only: `r:totlib`.
 * No component reconstruction for Prospectus.
 */
export function resolveCtosTotalLiabilities(
  account: CtosFinancialHighlightAccount
): number | null {
  if (!isFinitePresent(account.totlib)) return null;
  return account.totlib;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Return On Assets (ROA) [%]:
 * `r:plnpat div r:totass * 100`
 * Returns percent points (e.g. 8.5 means 8.5%).
 */
export function resolveCtosReturnOnAssetsPercent(
  account: CtosFinancialHighlightAccount
): number | null {
  const plnpat = account.plnpat;
  const totass = account.totass;
  if (!isFinitePresent(plnpat) || !isFinitePresent(totass) || totass === 0) return null;
  return (plnpat / totass) * 100;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — PAT Margin [%]:
 * `r:plnpat div r:turnover * 100`
 * Returns percent points. Do not use `profit_margin` (that is PBT Margin).
 */
export function resolveCtosPatMarginPercent(
  account: CtosFinancialHighlightAccount
): number | null {
  const plnpat = account.plnpat;
  const turnover = account.turnover;
  if (!isFinitePresent(plnpat) || !isFinitePresent(turnover) || turnover === 0) return null;
  return (plnpat / turnover) * 100;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Total Asset Turnover:
 * `r:turnover div r:totass`
 * Returns a plain multiple (x).
 */
export function resolveCtosTotalAssetTurnover(
  account: CtosFinancialHighlightAccount
): number | null {
  const turnover = account.turnover;
  const totass = account.totass;
  if (!isFinitePresent(turnover) || !isFinitePresent(totass) || totass === 0) return null;
  return turnover / totass;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights — Gearing / Debt-to-Equity as a multiple (x).
 *
 * Direct field wins when present:
 *   `r:gear` (Gearing Ratio in XSL)
 *
 * Else official XSL Gearing Ratio calculation:
 *   `r:totlib div r:networth`
 *
 * Prospectus Page 3 "Debt / Equity" displays as `x` (not %).
 * Never use this for Page 2 Net Debt / Equity.
 */
export function resolveCtosGearingRatio(
  account: CtosFinancialHighlightAccount
): number | null {
  if (isFinitePresent(account.gear)) return account.gear;
  const totlib = account.totlib;
  const networth = account.networth;
  if (!isFinitePresent(totlib) || !isFinitePresent(networth) || networth === 0) return null;
  return totlib / networth;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Debt to Equity Ratio [%]:
 * `r:totlib div r:networth * 100` when networth and totlib are non-zero.
 * Returns percent points. Prefer {@link resolveCtosGearingRatio} for Prospectus `x` display.
 */
export function resolveCtosDebtToEquityPercent(
  account: CtosFinancialHighlightAccount
): number | null {
  const totlib = account.totlib;
  const networth = account.networth;
  if (!isFinitePresent(totlib) || !isFinitePresent(networth) || networth === 0 || totlib === 0) {
    return null;
  }
  return (totlib / networth) * 100;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Working Capital Days:
 * `((r:bscatot - r:curlib) * 365) div r:turnover`
 * Not Receivables Days and not Payables Days.
 */
export function resolveCtosWorkingCapitalDays(
  account: CtosFinancialHighlightAccount
): number | null {
  const bscatot = account.bscatot;
  const curlib = account.curlib;
  const turnover = account.turnover;
  if (!isFinitePresent(bscatot) || !isFinitePresent(curlib) || !isFinitePresent(turnover)) {
    return null;
  }
  if (turnover === 0) return null;
  return ((bscatot - curlib) * 365) / turnover;
}

/**
 * CTOS ENQWS v5.11.0 Financial Highlights XSL — Return on Capital:
 * `r:turnover div r:networth`
 * Not currently a Prospectus row; exposed for parity / future use.
 */
export function resolveCtosReturnOnCapital(
  account: CtosFinancialHighlightAccount
): number | null {
  const turnover = account.turnover;
  const networth = account.networth;
  if (!isFinitePresent(turnover) || !isFinitePresent(networth) || networth === 0) return null;
  return turnover / networth;
}
