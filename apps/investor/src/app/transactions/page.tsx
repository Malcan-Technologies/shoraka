"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useOrganization } from "@cashsouk/config";
import { Card, CardContent, CardHeader, CardTitle, useHeader } from "@cashsouk/ui";
import { TransactionsSummaryCards } from "./components/transactions-summary-cards";
import { TransactionsActions } from "./components/transactions-actions";
import { TransactionsTable, type TransactionFilters } from "./components/transactions-table";
import { WithdrawRequestDialog } from "./components/withdraw-request-dialog";
import { WithdrawConfirmDialog } from "./components/withdraw-confirm-dialog";
import { WithdrawSuccessDialog } from "./components/withdraw-success-dialog";
import { DepositDialog } from "./components/deposit-dialog";
import { DepositSuccessDialog } from "./components/deposit-success-dialog";
import { StatementDialog } from "./components/statement-dialog";
import {
  MIN_DEPOSIT_AMOUNT,
  MIN_WITHDRAWAL_AMOUNT,
  TRANSACTION_TYPE_FILTER_OPTIONS,
  type Transaction,
  type TransactionType,
} from "./components/transactions.types";
import { mapActivityEntryToTransaction, parseMoneyAmount } from "./components/transaction-utils";
import {
  useInvestorBalanceActivityAll,
  useInvestorInvestments,
  useInvestorPortfolio,
  useInvestorPortfolioHistory,
} from "@/investments/hooks/use-marketplace-notes";

const PAGE_SIZE = 10;

function buildTrendMetric(currentValue: number, previousValue: number) {
  const deltaAmount = currentValue - previousValue;
  const deltaPercent = previousValue > 0 ? (deltaAmount / previousValue) * 100 : 0;
  return { trendAmount: Math.abs(deltaAmount), trendPercent: Math.abs(deltaPercent) };
}

function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters
): Transaction[] {
  const now = Date.now();
  const rangeMs: Record<TransactionFilters["timeRange"], number | null> = {
    all: null,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };

  return transactions.filter((tx) => {
    if (filters.type !== "all" && tx.type !== filters.type) return false;

    const range = rangeMs[filters.timeRange];
    if (range !== null && now - new Date(tx.postedAt).getTime() > range) return false;

    return true;
  });
}

function paginateTransactions(transactions: Transaction[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return transactions.slice(start, start + pageSize);
}

export default function TransactionsPage() {
  const { setTitle } = useHeader();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;

  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<TransactionFilters>({
    type: "all",
    timeRange: "all",
  });

  const [depositOpen, setDepositOpen] = React.useState(false);
  const [depositSuccessOpen, setDepositSuccessOpen] = React.useState(false);
  const [withdrawRequestOpen, setWithdrawRequestOpen] = React.useState(false);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = React.useState(false);
  const [withdrawSuccessOpen, setWithdrawSuccessOpen] = React.useState(false);
  const [statementOpen, setStatementOpen] = React.useState(false);

  const [depositAmount, setDepositAmount] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");
  const [depositError, setDepositError] = React.useState<string | null>(null);
  const [withdrawError, setWithdrawError] = React.useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = React.useState(0);

  const [statementStartDate, setStatementStartDate] = React.useState("");
  const [statementEndDate, setStatementEndDate] = React.useState("");

  const portfolioQuery = useInvestorPortfolio(orgId);
  const portfolioHistoryQuery = useInvestorPortfolioHistory("1W", orgId);
  const activityQuery = useInvestorBalanceActivityAll(orgId);
  const investmentsQuery = useInvestorInvestments();

  const noteReferenceById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const note of investmentsQuery.data?.notes ?? []) {
      map.set(note.id, note.noteReference);
    }
    return map;
  }, [investmentsQuery.data?.notes]);

  React.useEffect(() => {
    setTitle("Transactions");
  }, [setTitle]);

  React.useEffect(() => {
    const typeParam = searchParams.get("type");
    if (
      typeParam &&
      (TRANSACTION_TYPE_FILTER_OPTIONS as readonly string[]).includes(typeParam)
    ) {
      setFilters((current) => ({ ...current, type: typeParam as TransactionType }));
      setPage(1);
    }
  }, [searchParams]);

  const portfolioTotal = Number(portfolioQuery.data?.portfolioTotal ?? 0);
  const totalInvestment = Number(portfolioQuery.data?.totalInvestment ?? 0);
  const availableBalance = Number(portfolioQuery.data?.availableBalance ?? 0);

  const portfolioTrend = React.useMemo(() => {
    const points = portfolioHistoryQuery.data?.points ?? [];
    if (points.length === 0) return buildTrendMetric(portfolioTotal, portfolioTotal);
    const first = points[0];
    const last = points[points.length - 1];
    return buildTrendMetric(
      last ? last.portfolioTotal : portfolioTotal,
      first ? first.portfolioTotal : portfolioTotal
    );
  }, [portfolioHistoryQuery.data?.points, portfolioTotal]);

  const investmentTrend = React.useMemo(() => {
    const points = portfolioHistoryQuery.data?.points ?? [];
    if (points.length === 0) return buildTrendMetric(totalInvestment, totalInvestment);
    const first = points[0];
    const last = points[points.length - 1];
    const previous = first ? first.portfolioTotal - first.availableBalance : totalInvestment;
    const current = last ? last.portfolioTotal - last.availableBalance : totalInvestment;
    return buildTrendMetric(current, previous);
  }, [portfolioHistoryQuery.data?.points, totalInvestment]);

  const balanceTrend = React.useMemo(() => {
    const points = portfolioHistoryQuery.data?.points ?? [];
    if (points.length === 0) return buildTrendMetric(availableBalance, availableBalance);
    const first = points[0];
    const last = points[points.length - 1];
    return buildTrendMetric(
      last ? last.availableBalance : availableBalance,
      first ? first.availableBalance : availableBalance
    );
  }, [availableBalance, portfolioHistoryQuery.data?.points]);

  const summary = {
    totalPortfolioSize: portfolioTotal,
    totalInvestment,
    availableBalance,
    portfolioTrend,
    investmentTrend,
    balanceTrend,
  };

  const allTransactions = React.useMemo(() => {
    const entries = activityQuery.data?.entries ?? [];
    if (entries.length === 0) return [];

    const sorted = [...entries].sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );

    let runningBalance = Number(activityQuery.data?.summary.availableBalance ?? 0);
    return sorted.map((entry) => {
      const tx = mapActivityEntryToTransaction(entry, runningBalance, noteReferenceById);
      if (entry.direction === "IN") {
        runningBalance -= entry.amount;
      } else {
        runningBalance += entry.amount;
      }
      return tx;
    });
  }, [activityQuery.data?.entries, activityQuery.data?.summary, noteReferenceById]);

  const filteredTransactions = React.useMemo(
    () => filterTransactions(allTransactions, filters),
    [allTransactions, filters]
  );
  const paginatedTransactions = paginateTransactions(filteredTransactions, page, PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [filters, orgId]);

  function validateDepositAmount(): number | null {
    const amount = parseMoneyAmount(depositAmount);
    if (!amount || amount < MIN_DEPOSIT_AMOUNT) {
      setDepositError(`Minimum deposit is RM ${MIN_DEPOSIT_AMOUNT}`);
      return null;
    }
    setDepositError(null);
    return amount;
  }

  function validateWithdrawAmount(): number | null {
    const amount = parseMoneyAmount(withdrawAmount);
    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
      setWithdrawError(`Minimum withdrawal is RM ${MIN_WITHDRAWAL_AMOUNT}`);
      return null;
    }
    setWithdrawError(null);
    return amount;
  }

  function handleDepositSuccess(amount: number) {
    setConfirmedAmount(amount);
    setDepositOpen(false);
    setDepositSuccessOpen(true);
    setDepositAmount("");
  }

  function handleWithdrawSubmit() {
    const amount = validateWithdrawAmount();
    if (amount === null) return;
    setConfirmedAmount(amount);
    setWithdrawRequestOpen(false);
    setWithdrawConfirmOpen(true);
  }

  function handleWithdrawConfirm() {
    setWithdrawConfirmOpen(false);
    setWithdrawSuccessOpen(true);
    setWithdrawAmount("");
  }

  function handleSeeWithdrawalHistory() {
    setWithdrawRequestOpen(false);
    setPage(1);
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <TransactionsSummaryCards summary={summary} />
            <TransactionsActions
              onDeposit={() => setDepositOpen(true)}
              onWithdraw={() => setWithdrawRequestOpen(true)}
              onDownloadStatement={() => setStatementOpen(true)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-white shadow-sm">
        <CardContent className="p-6">
          <TransactionsTable
            transactions={paginatedTransactions}
            totalCount={filteredTransactions.length}
            page={page}
            pageSize={PAGE_SIZE}
            filters={filters}
            onFiltersChange={setFilters}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        investorOrganizationId={orgId}
        amount={depositAmount}
        onAmountChange={setDepositAmount}
        validationError={depositError}
        onValidationErrorChange={setDepositError}
        onBankTransfer={() => {
          const amount = validateDepositAmount();
          if (amount !== null) handleDepositSuccess(amount);
        }}
        onFpx={() => {
          const amount = validateDepositAmount();
          if (amount !== null) handleDepositSuccess(amount);
        }}
        onDevTopupSuccess={handleDepositSuccess}
      />

      <DepositSuccessDialog
        open={depositSuccessOpen}
        onOpenChange={setDepositSuccessOpen}
        amount={confirmedAmount}
      />

      <WithdrawRequestDialog
        open={withdrawRequestOpen}
        onOpenChange={setWithdrawRequestOpen}
        amount={withdrawAmount}
        onAmountChange={(value) => {
          setWithdrawAmount(value);
          if (withdrawError) setWithdrawError(null);
        }}
        validationError={withdrawError}
        onSubmit={handleWithdrawSubmit}
        onSeeWithdrawalHistory={handleSeeWithdrawalHistory}
      />

      <WithdrawConfirmDialog
        open={withdrawConfirmOpen}
        onOpenChange={setWithdrawConfirmOpen}
        amount={confirmedAmount}
        onConfirm={handleWithdrawConfirm}
      />

      <WithdrawSuccessDialog
        open={withdrawSuccessOpen}
        onOpenChange={setWithdrawSuccessOpen}
        amount={confirmedAmount}
      />

      <StatementDialog
        open={statementOpen}
        onOpenChange={setStatementOpen}
        investorOrganizationId={orgId}
        startDate={statementStartDate}
        endDate={statementEndDate}
        onStartDateChange={setStatementStartDate}
        onEndDateChange={setStatementEndDate}
      />
    </div>
  );
}
