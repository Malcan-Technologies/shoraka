"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import {
  LoadingState,
  PageShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  portalPageGutterClassName,
  useHeader,
} from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { withdrawMinimumError } from "@/components/investor-money-copy";
import { InvestNowButton } from "@/components/invest-now-button";
import { InvestorInvestmentsList } from "@/investments/components/investor-investments-list";
import { marketplaceKeys, useInvestorPortfolio } from "@/investments/hooks/use-marketplace-notes";
import { DepositDialog } from "@/app/transactions/components/deposit-dialog";
import { StatementDialog } from "@/app/transactions/components/statement-dialog";
import { WithdrawConfirmDialog } from "@/app/transactions/components/withdraw-confirm-dialog";
import { WithdrawRequestDialog } from "@/app/transactions/components/withdraw-request-dialog";
import { WithdrawSuccessDialog } from "@/app/transactions/components/withdraw-success-dialog";
import { MIN_WITHDRAWAL_AMOUNT } from "@/app/transactions/components/transactions.types";
import { parseMoneyAmount } from "@/app/transactions/components/transaction-utils";
import {
  clearInvestorWithdrawalIntent,
  getOrCreateInvestorWithdrawalIntent,
} from "@/lib/investor-withdrawal-intent";
import { PortfolioCashBar } from "./portfolio-cash-bar";
import { PortfolioTransactionsPanel } from "./portfolio-transactions-panel";
import { transactionTypeFromSearchParam } from "./portfolio-transactions-model";
import {
  PORTFOLIO_PATH,
  PORTFOLIO_TAB_INVESTMENTS,
  PORTFOLIO_TAB_TRANSACTIONS,
  isPortfolioTab,
  portfolioTabFromSearchParams,
} from "./portfolio-tabs";

function PortfolioPageContent() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const { getAccessToken } = useAuthToken();

  const tab = portfolioTabFromSearchParams(searchParams.get("tab"), searchParams.get("type"));
  const typeFilter = transactionTypeFromSearchParam(searchParams.get("type"));

  const [depositOpen, setDepositOpen] = React.useState(false);
  const [withdrawRequestOpen, setWithdrawRequestOpen] = React.useState(false);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = React.useState(false);
  const [withdrawSuccessOpen, setWithdrawSuccessOpen] = React.useState(false);
  const [statementOpen, setStatementOpen] = React.useState(false);
  const [depositAmount, setDepositAmount] = React.useState("");
  const [withdrawAmount, setWithdrawAmount] = React.useState("");
  const [depositError, setDepositError] = React.useState<string | null>(null);
  const [withdrawError, setWithdrawError] = React.useState<string | null>(null);
  const [withdrawConfirmError, setWithdrawConfirmError] = React.useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = React.useState(0);

  const queryClient = useQueryClient();
  const portfolioQuery = useInvestorPortfolio(orgId);
  const apiClient = React.useMemo(
    () => createApiClient(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", getAccessToken),
    [getAccessToken]
  );

  React.useEffect(() => {
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

  const replacePortfolioQuery = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const query = next.toString();
      router.replace(query ? `${PORTFOLIO_PATH}?${query}` : PORTFOLIO_PATH, { scroll: false });
    },
    [router, searchParams]
  );

  const requestWithdrawalMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("No investor organization selected");
      const withdrawalIntentId = getOrCreateInvestorWithdrawalIntent(orgId, confirmedAmount);
      const response = await apiClient.requestInvestorWithdrawal({
        amount: confirmedAmount,
        investorOrganizationId: orgId,
        withdrawalIntentId,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      if (orgId) clearInvestorWithdrawalIntent(orgId);
      setWithdrawConfirmOpen(false);
      setWithdrawSuccessOpen(true);
      setWithdrawAmount("");
      setWithdrawConfirmError(null);
      void queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioRoot });
      void queryClient.invalidateQueries({ queryKey: marketplaceKeys.investorBalanceActivityRoot });
    },
    onError: (error) => {
      setWithdrawConfirmError(
        error instanceof Error ? error.message : "We couldn't send this withdrawal. Try again."
      );
    },
  });

  function onTabChange(next: string) {
    if (!isPortfolioTab(next)) return;
    replacePortfolioQuery((params) => {
      if (next === PORTFOLIO_TAB_INVESTMENTS) {
        params.delete("tab");
        params.delete("type");
        return;
      }
      params.set("tab", PORTFOLIO_TAB_TRANSACTIONS);
    });
  }

  function handleTypeFilterChange(type: typeof typeFilter) {
    replacePortfolioQuery((params) => {
      params.set("tab", PORTFOLIO_TAB_TRANSACTIONS);
      if (type === "all") {
        params.delete("type");
      } else {
        params.set("type", type);
      }
    });
  }

  function validateWithdrawAmount(): number | null {
    const amount = parseMoneyAmount(withdrawAmount);
    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
      setWithdrawError(withdrawMinimumError(MIN_WITHDRAWAL_AMOUNT));
      return null;
    }
    setWithdrawError(null);
    return amount;
  }

  function handleWithdrawSubmit() {
    const amount = validateWithdrawAmount();
    if (amount === null) return;
    setConfirmedAmount(amount);
    setWithdrawRequestOpen(false);
    setWithdrawConfirmOpen(true);
  }

  function handleSeeWithdrawalHistory() {
    setWithdrawRequestOpen(false);
    replacePortfolioQuery((params) => {
      params.set("tab", PORTFOLIO_TAB_TRANSACTIONS);
      params.set("type", "Withdrawal");
    });
  }

  return (
    <div className={cn(portalPageGutterClassName, "space-y-6")}>
      <PageShell
        title="Portfolio"
        description="See your positions and cash movements in one place."
        action={
          <InvestNowButton
            variant="outline"
            className="h-11 shrink-0 gap-2 rounded-xl border-primary text-primary hover:bg-primary/5"
          />
        }
      >
        <PortfolioCashBar
          availableBalance={Number(portfolioQuery.data?.availableBalance ?? 0)}
          totalInvestment={Number(portfolioQuery.data?.totalInvestment ?? 0)}
          confirmedInvestment={Number(
            portfolioQuery.data?.confirmedInvestment ?? portfolioQuery.data?.totalInvestment ?? 0
          )}
          reservedInvestment={Number(portfolioQuery.data?.reservedInvestment ?? 0)}
          isLoading={portfolioQuery.isLoading}
          onDeposit={() => setDepositOpen(true)}
          onWithdraw={() => setWithdrawRequestOpen(true)}
        />

        <Tabs value={tab} onValueChange={onTabChange} className="w-full">
          <TabsList>
            <TabsTrigger value={PORTFOLIO_TAB_INVESTMENTS}>Investments</TabsTrigger>
            <TabsTrigger value={PORTFOLIO_TAB_TRANSACTIONS}>Transactions</TabsTrigger>
          </TabsList>

          <TabsContent value={PORTFOLIO_TAB_INVESTMENTS} className="mt-6">
            <InvestorInvestmentsList showStatusFilter />
          </TabsContent>

          <TabsContent value={PORTFOLIO_TAB_TRANSACTIONS} className="mt-6">
            <PortfolioTransactionsPanel
              typeFilter={typeFilter}
              onTypeFilterChange={handleTypeFilterChange}
              onDownloadStatement={() => setStatementOpen(true)}
            />
          </TabsContent>
        </Tabs>
      </PageShell>

      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        investorOrganizationId={orgId}
        amount={depositAmount}
        onAmountChange={setDepositAmount}
        validationError={depositError}
        onValidationErrorChange={setDepositError}
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
        onConfirm={() => {
          setWithdrawConfirmError(null);
          requestWithdrawalMutation.mutate();
        }}
        isLoading={requestWithdrawalMutation.isPending}
        errorMessage={withdrawConfirmError}
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
      />
    </div>
  );
}

export function PortfolioPage() {
  return (
    <Suspense fallback={<LoadingState variant="cards" rows={3} />}>
      <PortfolioPageContent />
    </Suspense>
  );
}
