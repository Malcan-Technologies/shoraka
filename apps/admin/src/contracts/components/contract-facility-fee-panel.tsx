"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency } from "@cashsouk/config";
import { StatusBadge } from "@cashsouk/ui";
import { ArrowTopRightOnSquareIcon, BanknotesIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { ReasonConfirmDialog } from "@/components/reason-confirm-dialog";
import { useGatewayPayments } from "@/hooks/use-gateway-payments";
import {
  PURPOSE_LABEL,
  STATUS_LABEL,
  formatGatewayPaymentDate,
  statusToken,
} from "@/lib/gateway-payment-display";
import {
  ContractDetailRow,
  CONTRACT_EMPTY_LABEL,
  formatContractFieldValue,
} from "./contract-detail-fields";
import {
  useSetContractFacilityEnabled,
  useWaiveContractFacilityFee,
} from "@/contracts/hooks/use-contract-facility-actions";
import {
  canWaiveContractFacilityFee,
  resolveContractFacilityFeeWaitingNote,
  type ContractFacilityFeeLedger,
} from "@/contracts/utils/contract-facility-metrics";
import { ADMIN_WAITING_SURFACE_CLASS } from "@/lib/admin-status-token";
import {
  facilityFeePaymentReference,
  resolveFacilityFeeHistoryState,
} from "@/contracts/utils/contract-facility-fee-history";

export function ContractFacilityFeePanel({
  contractId,
  facilityFeeRatePercent,
  ledger,
  canManage,
}: {
  contractId: string;
  facilityFeeRatePercent: number | null;
  ledger: ContractFacilityFeeLedger;
  canManage: boolean;
}) {
  const waiveFee = useWaiveContractFacilityFee();
  const setEnabled = useSetContractFacilityEnabled();
  const [waiverOpen, setWaiverOpen] = React.useState(false);
  const [waiverReason, setWaiverReason] = React.useState("");
  const [enableDialog, setEnableDialog] = React.useState<"enable" | "disable" | null>(null);
  const [enableReason, setEnableReason] = React.useState("");
  const [enableError, setEnableError] = React.useState<string | null>(null);
  const canWaive = canWaiveContractFacilityFee(ledger);
  const waitingNote = resolveContractFacilityFeeWaitingNote(ledger);
  const pending = waiveFee.isPending || setEnabled.isPending;
  const historyQuery = useGatewayPayments({
    purpose: "FACILITY_FEE",
    contractId,
    page: 1,
    pageSize: 20,
  });
  const historyItems = historyQuery.data?.items ?? [];
  const historyState = resolveFacilityFeeHistoryState({
    isLoading: historyQuery.isLoading,
    isError: Boolean(historyQuery.error),
    items: historyItems,
  });

  const handleToggle = (nextEnabled: boolean) => {
    if (!canManage || pending) return;
    setEnableError(null);
    setEnableReason("");
    setEnableDialog(nextEnabled ? "enable" : "disable");
  };

  const confirmEnableChange = async () => {
    if (!enableDialog) return;
    if (enableDialog === "disable" && enableReason.trim().length === 0) return;
    try {
      await setEnabled.mutateAsync({
        id: contractId,
        enabled: enableDialog === "enable",
        reason: enableReason.trim() || undefined,
      });
      toast.success(enableDialog === "enable" ? "Facility enabled" : "Facility disabled");
      setEnableDialog(null);
      setEnableReason("");
      setEnableError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update facility status";
      setEnableError(message);
      toast.error(message);
    }
  };

  const confirmWaiver = async () => {
    if (waiverReason.trim().length === 0) return;
    try {
      await waiveFee.mutateAsync({ id: contractId, reason: waiverReason.trim() });
      toast.success("Remaining facility fee waived");
      setWaiverOpen(false);
      setWaiverReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to waive facility fee");
    }
  };

  return (
    <>
      <Card className="rounded-2xl">
        <AdminDetailCardHeader
          icon={BanknotesIcon}
          title="Facility fee"
          description="Total owed, charged, upfront gateway collection, and remaining facility fee. The upfront request is frozen from the facility offer."
        />
        <CardContent className="space-y-4 pt-0">
          {waitingNote ? (
            <div
              className={`rounded-xl border px-3 py-2.5 ${ADMIN_WAITING_SURFACE_CLASS}`}
              role="status"
            >
              <p className="text-ui font-medium text-foreground">{waitingNote.title}</p>
              <p className="mt-1 text-ui text-muted-foreground">{waitingNote.description}</p>
            </div>
          ) : null}
          <div className="grid gap-x-8 sm:grid-cols-2">
            <div>
              <ContractDetailRow
                label="Facility fee rate"
                value={
                  facilityFeeRatePercent == null
                    ? CONTRACT_EMPTY_LABEL
                    : formatContractFieldValue("facility_fee_rate_percent", facilityFeeRatePercent)
                }
              />
              <ContractDetailRow label="Total owed" value={formatCurrency(ledger.owed)} />
              <ContractDetailRow label="Total charged" value={formatCurrency(ledger.charged)} />
              <ContractDetailRow
                label="Upfront requested"
                value={formatCurrency(ledger.upfrontRequested)}
              />
            </div>
            <div>
              <ContractDetailRow
                label="Paid toward upfront"
                value={formatCurrency(ledger.paidTowardUpfront)}
              />
              <ContractDetailRow
                label="Upfront outstanding"
                value={formatCurrency(ledger.upfrontOutstanding)}
              />
              <ContractDetailRow label="Waived" value={formatCurrency(ledger.waived)} />
              <ContractDetailRow
                label="Remaining facility fee"
                value={formatCurrency(ledger.remaining)}
              />
              <ContractDetailRow
                label="Status"
                value={ledger.enabled ? "Enabled" : "Disabled"}
              />
            </div>
          </div>
          {ledger.disabledReason ? (
            <p className="text-ui text-muted-foreground">
              Disable reason: {ledger.disabledReason}
            </p>
          ) : null}
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div>
              <h3 className="text-ui font-medium text-foreground">Payment history</h3>
              <p className="text-meta text-muted-foreground">
                Gateway payments for this facility fee. Admin cannot start a new payment here.
              </p>
            </div>
            {historyState === "loading" ? (
              <div className="space-y-2" aria-live="polite" aria-busy="true">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <span className="sr-only">Loading facility fee payments</span>
              </div>
            ) : null}
            {historyState === "error" ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5" role="alert">
                <p className="text-ui text-destructive">Could not load facility fee payments.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void historyQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : null}
            {historyState === "empty" ? (
              <p className="text-ui text-muted-foreground">
                No facility fee gateway payments yet.
              </p>
            ) : null}
            {historyState === "ready" ? (
              <ul className="divide-y divide-border/60 rounded-xl border">
                {historyItems.map((item) => {
                  const reference = facilityFeePaymentReference(item);
                  return (
                    <li key={item.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch
                id="contract-facility-enabled"
                checked={ledger.enabled}
                disabled={!canManage || pending}
                onCheckedChange={handleToggle}
              />
              <Label htmlFor="contract-facility-enabled" className="text-ui">
                Facility enabled
              </Label>
            </div>
            {canWaive ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={!canManage || pending}
                onClick={() => {
                  setWaiverReason("");
                  setWaiverOpen(true);
                }}
              >
                Waive remaining facility fee
              </Button>
            ) : ledger.waivedAtContract ? (
              <p className="text-ui text-muted-foreground">Remaining facility fee is waived.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <ReasonConfirmDialog
        open={enableDialog != null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setEnableDialog(null);
            setEnableError(null);
          }
        }}
        title={enableDialog === "disable" ? "Disable this facility?" : "Enable this facility?"}
        description={
          enableDialog === "disable"
            ? "Disabling stops new invoice offers on this facility. A reason is required. Live marketplace notes will block this change."
            : "Enabling allows new invoice offers against this facility."
        }
        confirmLabel={enableDialog === "disable" ? "Disable facility" : "Enable facility"}
        pending={setEnabled.isPending}
        reason={enableReason}
        onReasonChange={setEnableReason}
        reasonId="contract-facility-enabled-reason"
        reasonRequired={enableDialog === "disable"}
        error={enableError}
        onConfirm={() => void confirmEnableChange()}
      />

      <ReasonConfirmDialog
        open={waiverOpen}
        onOpenChange={(open) => {
          if (!open && !waiveFee.isPending) setWaiverOpen(false);
        }}
        title="Waive remaining facility fee?"
        description="This waives the uncharged remainder on this facility. Already charged amounts are not reversed. A reason is required."
        confirmLabel="Waive remaining fee"
        pending={waiveFee.isPending}
        reason={waiverReason}
        onReasonChange={setWaiverReason}
        reasonId="contract-facility-fee-waiver-reason"
        onConfirm={() => void confirmWaiver()}
      />
    </>
  );
}
