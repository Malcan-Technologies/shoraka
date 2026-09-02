"use client";

import { ArrowPathIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import type { AdminInvestmentSettlementConfirmationsPayload } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { workflowToneToStatusToken, type WorkflowStatusTone } from "@/notes/utils/workflow-status-tokens";
import {
  useOpenAdminInvestmentSettlementConfirmation,
  useRetryAdminInvestmentSettlementConfirmation,
} from "@/notes/hooks/use-investment-settlement-confirmation";

function overallModel(payload: AdminInvestmentSettlementConfirmationsPayload): {
  label: string;
  tone: WorkflowStatusTone;
  emphasize: boolean;
  description: string;
} {
  if (payload.expectedCount === 0 && payload.confirmations.length === 0) {
    return {
      label: "Not issued",
      tone: "neutral",
      emphasize: false,
      description: "Issued to each investor after settlement is posted and wallets are credited.",
    };
  }
  if (payload.failedCount > 0) {
    return {
      label: "Failed",
      tone: "active",
      emphasize: true,
      description: `${payload.failedCount} investor confirmation${payload.failedCount === 1 ? "" : "s"} failed. Settlement and wallet credits are unchanged. Retry uses the frozen snapshot.`,
    };
  }
  if (payload.pendingCount > 0 || payload.readyCount < payload.expectedCount) {
    return {
      label: "Generating",
      tone: "warning",
      emphasize: false,
      description: "Investor confirmation PDFs are being generated. Settlement posting is unchanged.",
    };
  }
  return {
    label: "Ready",
    tone: "success",
    emphasize: false,
    description: `${payload.readyCount} investor confirmation${payload.readyCount === 1 ? "" : "s"} ready for this posted settlement.`,
  };
}

type Props = {
  noteId: string;
  payload: AdminInvestmentSettlementConfirmationsPayload;
  canRetry: boolean;
};

export function InvestmentSettlementConfirmationCard({ noteId, payload, canRetry }: Props) {
  const model = overallModel(payload);
  const openPdf = useOpenAdminInvestmentSettlementConfirmation(noteId);
  const retry = useRetryAdminInvestmentSettlementConfirmation(noteId);

  return (
    <Card
      data-investment-settlement-confirmation-card
      data-confirmation-ready={payload.readyCount}
      data-confirmation-failed={payload.failedCount}
      className={cn("rounded-2xl", model.emphasize && ADMIN_ACTION_SURFACE_CLASS)}
    >
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <DocumentTextIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle>Investor settlement confirmations</CardTitle>
              <StatusBadge label={model.label} status={workflowToneToStatusToken(model.tone)} />
            </div>
          </div>
        </div>
        <p className="text-meta text-muted-foreground">{model.description}</p>
        {payload.confirmations.length > 0 ? (
          <ul className="space-y-2">
            {payload.confirmations.map((row) => (
              <li
                key={row.investorOrganizationId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-ui font-medium text-foreground">{row.investorReference}</p>
                  <p className="text-meta text-muted-foreground">{row.status}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.status === "READY" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void openPdf.mutateAsync(row.investorOrganizationId).catch((err) => {
                          toast.error(
                            err instanceof Error ? err.message : "Confirmation is not available"
                          );
                        });
                      }}
                      disabled={openPdf.isPending}
                    >
                      View
                    </Button>
                  ) : null}
                  {row.canRetry && canRetry ? (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        void retry.mutateAsync(row.investorOrganizationId).catch((err) => {
                          toast.error(err instanceof Error ? err.message : "Retry failed");
                        });
                      }}
                      disabled={retry.isPending}
                    >
                      <ArrowPathIcon className="h-4 w-4" aria-hidden />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </CardHeader>
    </Card>
  );
}
