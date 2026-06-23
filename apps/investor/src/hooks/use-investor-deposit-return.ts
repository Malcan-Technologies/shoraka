"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@cashsouk/config";
import { marketplaceKeys } from "@/investments/hooks/use-marketplace-notes";
import {
  isTerminalDepositStatus,
  useInvestorDepositQuery,
} from "@/hooks/use-investor-deposit";

export function useInvestorDepositReturn(depositId: string) {
  const queryClient = useQueryClient();
  const { refreshOrganizations } = useOrganization();
  const query = useInvestorDepositQuery(depositId, { pollUntilTerminal: true });

  useEffect(() => {
    const deposit = query.data;
    if (!deposit || !isTerminalDepositStatus(deposit.status)) return;

    queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioRoot });
    queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioHistoryRoot });
    queryClient.invalidateQueries({ queryKey: marketplaceKeys.investorBalanceActivityRoot });

    if (deposit.status === "COMPLETED") {
      void refreshOrganizations();
    }
  }, [query.data, queryClient, refreshOrganizations]);

  return query;
}
