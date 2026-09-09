"use client";

import type { IssuerDashboardBook } from "@cashsouk/types";
import type { NormalizedApplication } from "@/app/(application-management)/applications/status";
import type { IssuerDashboardInvoice } from "@/types/issuer-dashboard";
import { IssuerDashboardMetricCards } from "./issuer-dashboard-metric-cards";
import { WhereThingsStandCard } from "./where-things-stand-card";
import { IssuerDashboardFundingProgress } from "./issuer-dashboard-funding-progress";
import { IssuerDashboardRepaymentSchedule } from "./issuer-dashboard-repayment-schedule";
import { IssuerDashboardOutstandingChart } from "./issuer-dashboard-charts";
import { IssuerDashboardCostOfFinancing } from "./issuer-dashboard-cost-of-financing";

export function IssuerDashboardActive({
  book,
  onTimePercent,
  pastDueCount,
  applications,
  invoices,
}: {
  book: IssuerDashboardBook;
  onTimePercent: number | null;
  pastDueCount: number | null;
  applications: readonly NormalizedApplication[];
  invoices: readonly IssuerDashboardInvoice[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <IssuerDashboardMetricCards
        book={book}
        onTimePercent={onTimePercent}
        pastDueCount={pastDueCount}
      />
      <WhereThingsStandCard applications={applications} invoices={invoices} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <IssuerDashboardFundingProgress items={book.fundingProgress} />
        <IssuerDashboardRepaymentSchedule book={book} />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <IssuerDashboardOutstandingChart points={book.outstandingOverTime} />
        <IssuerDashboardCostOfFinancing cost={book.costOfFinancingYtd} />
      </div>
    </div>
  );
}
