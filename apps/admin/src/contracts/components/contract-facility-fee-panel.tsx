"use client";

import * as React from "react";
import { toast } from "sonner";
import { formatCurrency } from "@cashsouk/config";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { ReasonConfirmDialog } from "@/components/reason-confirm-dialog";
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
  type ContractFacilityFeeLedger,
} from "@/contracts/utils/contract-facility-metrics";

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
  const pending = waiveFee.isPending || setEnabled.isPending;

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
          description="Owed, charged, waived, and remaining facility fee on this line of credit."
        />
        <CardContent className="space-y-4 pt-0">
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
              <ContractDetailRow label="Owed" value={formatCurrency(ledger.owed)} />
              <ContractDetailRow label="Charged" value={formatCurrency(ledger.charged)} />
            </div>
            <div>
              <ContractDetailRow label="Waived" value={formatCurrency(ledger.waived)} />
              <ContractDetailRow label="Remaining" value={formatCurrency(ledger.remaining)} />
              <ContractDetailRow
                label="Status"
                value={ledger.enabled ? "Enabled" : "Disabled"}
              />
            </div>
          </div>
          {ledger.disabledReason ? (
            <p className="text-sm text-muted-foreground">
              Disable reason: {ledger.disabledReason}
            </p>
          ) : null}
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
              <p className="text-sm text-muted-foreground">Remaining facility fee is waived.</p>
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
