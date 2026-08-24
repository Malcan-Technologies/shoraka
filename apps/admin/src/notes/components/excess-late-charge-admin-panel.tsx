"use client";

import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { StatusBadge } from "@cashsouk/ui";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGatewayPayments } from "@/hooks/use-gateway-payments";
import {
  PURPOSE_LABEL,
  STATUS_LABEL,
  formatGatewayPaymentDate,
  statusToken,
} from "@/lib/gateway-payment-display";
import { ADMIN_WAITING_SURFACE_CLASS } from "@/lib/admin-status-token";
import {
  facilityFeePaymentReference,
  resolveFacilityFeeHistoryState,
} from "@/contracts/utils/contract-facility-fee-history";
import {
  excessLateChargeCompletedCopy,
  excessLateChargeOutstanding,
  excessLateChargeWaitingCopy,
} from "@/notes/utils/excess-late-charge-admin-ui";

export function ExcessLateChargeAdminPanel({
  noteId,
  owedAmount,
  paidAmount,
}: {
  noteId: string;
  owedAmount: number;
  paidAmount: number;
}) {
  const outstanding = excessLateChargeOutstanding(owedAmount, paidAmount);
  const historyQuery = useGatewayPayments({
    purpose: "EXCESS_LATE_CHARGES",
    noteId,
    page: 1,
    pageSize: 20,
  });
  const historyItems = historyQuery.data?.items ?? [];
  const historyState = resolveFacilityFeeHistoryState({
    isLoading: historyQuery.isLoading,
    isError: Boolean(historyQuery.error),
    items: historyItems,
  });

  if (owedAmount <= 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      {outstanding > 0 ? (
        <div className={`rounded-xl border px-3 py-2.5 ${ADMIN_WAITING_SURFACE_CLASS}`} role="status">
          <p className="text-ui text-foreground">{excessLateChargeWaitingCopy(outstanding)}</p>
        </div>
      ) : (
        <p className="text-ui font-medium text-foreground" role="status">
          {excessLateChargeCompletedCopy(owedAmount)}
        </p>
      )}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-meta text-muted-foreground">Late charges due</dt>
          <dd className="text-ui font-medium tabular-nums">{formatCurrency(owedAmount)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">Paid</dt>
          <dd className="text-ui font-medium tabular-nums">{formatCurrency(paidAmount)}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted-foreground">Outstanding</dt>
          <dd className="text-ui font-medium tabular-nums">{formatCurrency(outstanding)}</dd>
        </div>
      </dl>
      <div>
        <h3 className="text-ui font-medium text-foreground">Late charge payments</h3>
        <p className="text-meta text-muted-foreground">
          Gateway payments for separately billed late charges. The issuer pays these; admin cannot
          start a payment here.
        </p>
      </div>
      {historyState === "loading" ? (
        <div className="space-y-2" aria-live="polite" aria-busy="true">
          <Skeleton className="h-10 w-full rounded-xl" />
          <span className="sr-only">Loading late charge payments</span>
        </div>
      ) : null}
      {historyState === "error" ? (
        <p className="text-ui text-destructive">Could not load late charge payments.</p>
      ) : null}
      {historyState === "empty" ? (
        <p className="text-ui text-muted-foreground">No late charge gateway payments yet.</p>
      ) : null}
      {historyState === "ready" ? (
        <ul className="divide-y divide-border/60 rounded-xl border">
          {historyItems.map((item) => {
            const reference = facilityFeePaymentReference(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={STATUS_LABEL[item.status] ?? item.status}
                      status={statusToken(item.status)}
                    />
                    <span className="text-ui font-medium tabular-nums">
                      {formatCurrency(item.amount)}
                    </span>
                    <span className="text-meta text-muted-foreground">
                      {PURPOSE_LABEL[item.purpose] ?? item.purpose}
                    </span>
                  </div>
                  <p className="text-meta text-muted-foreground">
                    {formatGatewayPaymentDate(item.createdAt)}
                    {reference ? ` · ${reference}` : ""}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={`/finance/gateway-payments/${item.id}`}>
                    <ArrowTopRightOnSquareIcon className="mr-1 h-4 w-4" />
                    View payment
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
