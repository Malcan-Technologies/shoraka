"use client";

import { PlusIcon, MinusIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

interface TransactionsActionsProps {
  onDeposit: () => void;
  onWithdraw: () => void;
  onDownloadStatement: () => void;
}

export function TransactionsActions({
  onDeposit,
  onWithdraw,
  onDownloadStatement,
}: TransactionsActionsProps) {
  return (
    <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[200px]">
      <Button
        type="button"
        variant="action"
        className="h-11 w-full rounded-xl"
        onClick={onDeposit}
      >
        <PlusIcon className="h-4 w-4" />
        Deposit
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-xl border-primary text-primary hover:bg-primary/5"
        onClick={onWithdraw}
      >
        <MinusIcon className="h-4 w-4" />
        Withdraw
      </Button>
      <Button
        type="button"
        variant="link"
        className="h-11 w-full justify-center gap-2 text-primary"
        onClick={onDownloadStatement}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        Download statement
      </Button>
    </div>
  );
}
