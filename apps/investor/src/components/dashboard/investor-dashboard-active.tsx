"use client";

import type {
  InvestorPortfolioHistoryPoint,
  InvestorPortfolioResponse,
  NoteListItem,
} from "@cashsouk/types";
import { InvestorDashboardMetrics } from "./investor-dashboard-metrics";
import {
  InvestorDashboardCashflow,
  InvestorDashboardValueChart,
} from "./investor-dashboard-charts";
import { InvestorDashboardMarketplaceStrip } from "./investor-dashboard-marketplace-strip";
import { InvestorDashboardHoldings } from "./investor-dashboard-holdings";

export function InvestorDashboardActive({
  portfolio,
  historyPoints,
  marketplaceNotes,
  marketplaceTotalCount,
  seekingFunding,
  holdings,
  onDeposit,
}: {
  portfolio: InvestorPortfolioResponse;
  historyPoints: InvestorPortfolioHistoryPoint[];
  marketplaceNotes: NoteListItem[];
  marketplaceTotalCount: number;
  seekingFunding: number | null;
  holdings: NoteListItem[];
  onDeposit: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <InvestorDashboardMetrics portfolio={portfolio} onDeposit={onDeposit} />
      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
        <InvestorDashboardValueChart points={historyPoints} />
        <InvestorDashboardCashflow cashflow={portfolio.cashflowNext90Days} />
      </div>
      <InvestorDashboardMarketplaceStrip
        notes={marketplaceNotes}
        totalCount={marketplaceTotalCount}
        seekingFunding={seekingFunding}
      />
      <InvestorDashboardHoldings notes={holdings} />
    </div>
  );
}
