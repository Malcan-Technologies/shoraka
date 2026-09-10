"use client";

import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/solid";
import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  formatNoteDateEnMy,
  type InvestorPortfolioResponse,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { atRiskNoteCountCopy, idleDaysCopy } from "@/investments/dashboard-presentation";

export function InvestorDashboardMetrics({
  portfolio,
  onDeposit,
}: {
  portfolio: InvestorPortfolioResponse;
  onDeposit: () => void;
}) {
  const ytd = portfolio.ytdChangePercent;
  const ytdUp = ytd != null && ytd >= 0;
  const idle = idleDaysCopy(portfolio.idleDays);
  const returnsSince = formatNoteDateEnMy(portfolio.returnsSince);
  const atRisk = portfolio.atRisk;
  const atRiskLive = atRisk.count > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
        <CardContent className="p-5">
          <p className="text-ui font-medium text-primary">Portfolio value</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {formatCurrency(portfolio.portfolioTotal)}
          </p>
          {ytd != null ? (
            <p className="mt-1 flex items-center gap-1.5 text-ui">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  ytdUp ? "text-status-success-text" : "text-status-rejected-text"
                )}
              >
                {ytdUp ? (
                  <ArrowUpIcon className="h-3 w-3" />
                ) : (
                  <ArrowDownIcon className="h-3 w-3" />
                )}
                {formatInvestorReturnRatePercent(Math.abs(ytd))}
              </span>
              <span className="text-muted-foreground">this year</span>
            </p>
          ) : (
            <p className="mt-1 text-meta text-muted-foreground">Live book value</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <p className="text-ui font-medium text-muted-foreground">Available to invest</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {formatCurrency(portfolio.availableBalance)}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {idle ? `${idle} · ` : null}
            <button type="button" className="font-medium text-primary" onClick={onDeposit}>
              Deposit
            </button>
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <p className="text-ui font-medium text-muted-foreground">Returns earned</p>
          <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-status-success-text">
            {formatCurrency(portfolio.returnsEarned)}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {returnsSince ? `since ${returnsSince}` : "Settled profit"}
            {portfolio.netAnnualReturnPercent != null
              ? ` · ${formatInvestorReturnRatePercent(portfolio.netAnnualReturnPercent)} net p.a.`
              : null}
          </p>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "rounded-2xl shadow-sm",
          atRiskLive ? "border-status-rejected-text/40" : null
        )}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui font-medium text-muted-foreground">At risk</p>
            {atRiskLive ? (
              <StatusBadge label={atRiskNoteCountCopy(atRisk.count)} status="rejected" size="sm" showDot />
            ) : (
              <StatusBadge label="None late" status="neutral" size="sm" />
            )}
          </div>
          <p
            className={cn(
              "mt-2 text-3xl font-bold tabular-nums tracking-tight",
              atRiskLive ? "text-status-rejected-text" : "text-foreground"
            )}
          >
            {formatCurrency(atRisk.amount)}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {atRiskLive
              ? [
                  `${formatInvestorReturnRatePercent(atRisk.percent)} of portfolio`,
                  atRisk.maxDaysPastDue != null
                    ? `${atRisk.maxDaysPastDue} ${atRisk.maxDaysPastDue === 1 ? "day" : "days"} past due`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "No notes past due"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
