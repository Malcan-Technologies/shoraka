import type { ProspectusFrozenFinancialRaw } from "@cashsouk/types";

export type ProspectusPageTwoCalculatedMetric =
  | "ROE (%)"
  | "Current Ratio (x)"
  | "Net Debt / Equity (x)"
  | "Interest Coverage (x)"
  | "DSCR (x)"
  | "Receivables Days";

export function getProspectusPageTwoCalculatedMissingHint(args: {
  metric: ProspectusPageTwoCalculatedMetric;
  frozenRaw: ProspectusFrozenFinancialRaw;
  prevTradeReceivables: number | null;
}): string {
  const { metric, frozenRaw, prevTradeReceivables } = args;

  switch (metric) {
    case "ROE (%)": {
      const pat = frozenRaw.plnpat;
      const netWorth = frozenRaw.networth;
      if (pat == null) return "Missing: Profit / Loss After Tax";
      if (netWorth == null) return "Missing: Total Equity / Net Worth";
      if (netWorth === 0) return "Invalid: Total Equity / Net Worth is zero";
      return "Missing financial inputs";
    }
    case "Current Ratio (x)": {
      const currentAssets = frozenRaw.bscatot;
      const currentLiabilities = frozenRaw.curlib;
      if (currentAssets == null) return "Missing: Current Assets";
      if (currentLiabilities == null) return "Missing: Current Liabilities";
      if (currentLiabilities === 0) return "Invalid: Current Liabilities is zero";
      return "Missing financial inputs";
    }
    case "Net Debt / Equity (x)": {
      const cashAndBank = frozenRaw.cashAndBank;
      const netWorth = frozenRaw.networth;
      if (cashAndBank == null) return "Missing: Cash & Bank";
      if (netWorth == null) return "Missing: Total Equity / Net Worth";
      if (netWorth === 0) return "Invalid: Total Equity / Net Worth is zero";
      // Frozen raw does not contain the granular borrowings inputs required to name
      // "Current Borrowings" / "Non-current Loans".
      return "Missing financial inputs";
    }
    case "Interest Coverage (x)": {
      // Frozen raw includes EBIT and PBT, but not interest_cost.
      const ebit = frozenRaw.ebit;
      const pbt = frozenRaw.plnpbt;
      if (ebit == null) {
        if (pbt == null) return "Missing: Profit / Loss Before Tax";
        return "Missing: Interest Costs";
      }
      return "Missing financial inputs";
    }
    case "DSCR (x)": {
      const annualDebtService = frozenRaw.annualDebtService;
      const netOperatingIncome = frozenRaw.netOperatingIncome;
      if (annualDebtService == null) return "Missing: Annual Debt Service";
      if (annualDebtService === 0) return "Invalid: Annual Debt Service is zero";
      if (netOperatingIncome == null) return "Missing: Net Operating Income";
      return "Missing financial inputs";
    }
    case "Receivables Days": {
      const endingTradeReceivables = frozenRaw.tradeReceivables;
      const turnover = frozenRaw.turnover;
      if (prevTradeReceivables == null)
        return "Missing: previous financial year Trade Receivables";
      if (endingTradeReceivables == null) return "Missing: Trade Receivables";
      if (turnover == null) return "Missing: Revenue / Turnover";
      if (turnover === 0) return "Invalid: Revenue / Turnover is zero";
      return "Missing financial inputs";
    }
    default:
      // Should be unreachable due to metric union typing.
      return "Missing financial inputs";
  }
}

