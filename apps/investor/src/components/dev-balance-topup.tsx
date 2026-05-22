"use client";

/**
 * Dev-only: credits pool balance via POST /v1/investor/balance/test-topup.
 *
 * REMOVE_FOR_PRODUCTION:
 * - Delete this file
 * - Remove imports/usages from transactions and marketplace pages
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { marketplaceKeys } from "@/investments/hooks/use-marketplace-notes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useInvestorBalanceTestTopupMutation() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { investorOrganizationId: string; amount: number }) => {
      const apiClient = createApiClient(API_URL, getAccessToken);
      const response = await apiClient.postInvestorBalanceTestTopup(input);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioRoot });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.portfolioHistoryRoot });
      queryClient.invalidateQueries({ queryKey: marketplaceKeys.investorBalanceActivityRoot });
    },
  });
}

type Props = {
  investorOrganizationId: string | undefined;
  variant?: "inline" | "compact";
};

export function DevBalanceTopup({ investorOrganizationId, variant = "inline" }: Props) {
  const topUp = useInvestorBalanceTestTopupMutation();

  async function onTopUp(amount: number) {
    if (!investorOrganizationId) {
      toast.error("Select an investor organization first");
      return;
    }
    try {
      await topUp.mutateAsync({ investorOrganizationId, amount });
      toast.success(`Test top-up: RM ${amount.toLocaleString("en-MY")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test top-up failed");
    }
  }

  if (variant === "compact") {
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-amber-700/35 bg-amber-50/80 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/80">Dev top-up</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-amber-700/40 bg-white text-xs text-amber-950 hover:bg-amber-100/80"
            disabled={!investorOrganizationId || topUp.isPending}
            onClick={() => void onTopUp(10_000)}
          >
            + RM 10,000
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-amber-700/40 bg-white text-xs text-amber-950 hover:bg-amber-100/80"
            disabled={!investorOrganizationId || topUp.isPending}
            onClick={() => void onTopUp(50_000)}
          >
            + RM 50,000
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-dashed border-amber-700/35 bg-amber-50/80 px-3 py-2 md:items-end">
      <p className="text-[10px] font-medium uppercase tracking-wide text-amber-900/80">Dev only</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-amber-700/40 bg-white text-xs text-amber-950 hover:bg-amber-100/80"
          disabled={!investorOrganizationId || topUp.isPending}
          onClick={() => void onTopUp(10_000)}
        >
          + RM 10,000
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 border-amber-700/40 bg-white text-xs text-amber-950 hover:bg-amber-100/80"
          disabled={!investorOrganizationId || topUp.isPending}
          onClick={() => void onTopUp(50_000)}
        >
          + RM 50,000
        </Button>
      </div>
    </div>
  );
}

/** @deprecated Use DevBalanceTopup from @/components/dev-balance-topup */
export function InvestmentsDevBalanceTopup(props: Props) {
  return <DevBalanceTopup {...props} />;
}
