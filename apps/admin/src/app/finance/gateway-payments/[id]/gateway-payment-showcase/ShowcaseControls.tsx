"use client";

/**
 * TEMPORARY GATEWAY PAYMENT SHOWCASE
 * Remove after UI review — see REMOVAL.md in this folder.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGatewayPaymentDetailVisibility } from "../gateway-payment-detail-model";
import {
  SHOWCASE_SCENARIOS,
  type ShowcasePermissionMode,
  type ShowcaseScenario,
  type ShowcaseScenarioId,
} from "./scenarios";

type ShowcaseControlsProps = {
  scenarioId: ShowcaseScenarioId;
  onScenarioChange: (id: ShowcaseScenarioId) => void;
  permissionMode: ShowcasePermissionMode;
  onPermissionModeChange: (mode: ShowcasePermissionMode) => void;
  scenario: ShowcaseScenario;
  canManageEffective: boolean;
};

export function GatewayPaymentShowcaseControls({
  scenarioId,
  onScenarioChange,
  permissionMode,
  onPermissionModeChange,
  scenario,
  canManageEffective,
}: ShowcaseControlsProps) {
  const visibility = getGatewayPaymentDetailVisibility(scenario.payment);
  const groups = Array.from(new Set(SHOWCASE_SCENARIOS.map((item) => item.group)));

  return (
    <Card className="rounded-2xl border-dashed border-primary/40 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/40 text-primary">
            Dev only
          </Badge>
          <CardTitle className="text-base">Gateway Payment Showcase Mode</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Development preview only. No financial actions will be performed.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Scenario</span>
            <select
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={scenarioId}
              onChange={(event) =>
                onScenarioChange(event.target.value as ShowcaseScenarioId)
              }
            >
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {SHOWCASE_SCENARIOS.filter((item) => item.group === group).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Purpose (from scenario)</span>
            <div className="flex h-10 items-center rounded-xl border bg-muted/30 px-3 text-sm">
              {scenario.purpose}
            </div>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Status (from scenario)</span>
            <div className="flex h-10 items-center rounded-xl border bg-muted/30 px-3 text-sm">
              {scenario.status}
            </div>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Gateway account</span>
            <div className="flex h-10 items-center rounded-xl border bg-muted/30 px-3 text-sm">
              {scenario.gatewayAccount}
            </div>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted-foreground">Admin permission preview</span>
            <select
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={permissionMode}
              onChange={(event) =>
                onPermissionModeChange(event.target.value as ShowcasePermissionMode)
              }
            >
              <option value="real">Use real session permissions</option>
              <option value="manage">Force manage (actions enabled)</option>
              <option value="view-only">Force view-only (actions disabled)</option>
            </select>
          </label>
        </div>

        <div className="rounded-xl border bg-background/80 p-3 text-sm">
          <p className="font-medium">Why actions show / hide</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              Name check: {visibility.showNameCheckCard ? "visible" : "hidden"} — status
              NAME_CHECK_PENDING
            </li>
            <li>
              Initiate refund: {visibility.showInitiateRefund ? "visible" : "hidden"} —
              COMPLETED + INVESTOR_DEPOSIT
            </li>
            <li>
              Retry refund: {visibility.showRetryRefund ? "visible" : "hidden"} — HELD and
              not currency/wallet cards
            </li>
            <li>
              Retry wallet reversal:{" "}
              {visibility.showWalletReversalCard ? "visible" : "hidden"} — HELD +
              refundConfirmedWalletReversalFailed
            </li>
            <li>
              Amount mismatch pending:{" "}
              {visibility.showMismatchRefundPending ? "visible" : "hidden"}
            </li>
            <li>
              Currency mismatch: {visibility.showCurrencyMismatchCard ? "visible" : "hidden"}
            </li>
            <li>
              Effective canManage: {canManageEffective ? "yes" : "no"} (disabled buttons
              when no)
            </li>
          </ul>
          {scenario.notes.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-foreground/90">
              {scenario.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
