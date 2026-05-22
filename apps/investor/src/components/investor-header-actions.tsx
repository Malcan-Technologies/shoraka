"use client";

import { NotificationBell } from "@cashsouk/ui";
import { formatCurrency, useOrganization } from "@cashsouk/config";
import { useInvestorPortfolio } from "@/investments/hooks/use-marketplace-notes";

export function InvestorHeaderActions() {
  const { activeOrganization } = useOrganization();
  const { data: portfolio } = useInvestorPortfolio(activeOrganization?.id);
  const availableBalance = Number(portfolio?.availableBalance ?? 0);

  return (
    <>
      <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-sm md:flex">
        <span className="text-muted-foreground">Available balance</span>
        <span className="font-semibold text-foreground">{formatCurrency(availableBalance)}</span>
      </div>
      <NotificationBell />
    </>
  );
}
